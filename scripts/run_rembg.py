"""
Rembg Server with CUDA VRAM Capping & Graceful CPU Fallback
Created for Local Chat (RTX 4060 Laptop 8GB VRAM)

Features:
- Capped CUDA memory allocation (default 2048 MB / 2 GB via ONNX Runtime provider options).
- Single Active Model: unloads previous session and frees memory before loading a new model.
- Graceful CPU Fallback: if CUDA memory is exhausted during load or inference, falls back to CPU.
- Standard Rembg REST API compatible with Local Chat (/api/remove, /api docs, health check).
"""

import argparse
import asyncio
import gc
import ipaddress
import json
import logging
import os
import socket
import sys
from typing import List, Optional, Tuple, Union, cast
from urllib.parse import urljoin, urlparse

import aiohttp
import uvicorn
from asyncer import asyncify
from fastapi import Depends, FastAPI, File, Form, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from starlette.responses import JSONResponse, Response

from rembg import __version__, new_session, remove
from rembg.sessions import sessions_names
from rembg.sessions.base import BaseSession

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] [rembg-launcher] %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("rembg-launcher")


class VramManagedSessionPool:
    """Manages ONNX Runtime sessions with a hard VRAM ceiling and single active model policy."""

    def __init__(self, vram_limit_mb: int):
        self.vram_limit_mb = vram_limit_mb
        self.current_model: Optional[str] = None
        self.current_session: Optional[BaseSession] = None
        self.current_provider: str = "none"
        self._lock = asyncio.Lock()

    def _unload_current(self):
        if self.current_session is not None:
            logger.info(
                f"Melepaskan model aktif sebelumnya ('{self.current_model}') dari memori..."
            )
            del self.current_session
            self.current_session = None
            self.current_model = None
            self.current_provider = "none"
            gc.collect()

    def get_or_create_session(
        self, model_name: str, **kwargs
    ) -> Tuple[BaseSession, str]:
        # Jika model yang sama sudah aktif, gunakan langsung
        if self.current_session is not None and self.current_model == model_name:
            return self.current_session, self.current_provider

        # Model BiRefNet Massive membutuhkan >6 GB VRAM puncak pada forward pass 1024x1024.
        # Jika cap VRAM < 6 GB, langsung alihkan ke CPU agar stabil dan VRAM GPU tetap bebas untuk Ollama.
        if model_name == "birefnet-massive" and self.vram_limit_mb < 6000:
            logger.info(
                f"Model '{model_name}' membutuhkan >6 GB VRAM CUDA (cap saat ini: {self.vram_limit_mb} MB). "
                f"Mengalihkan langsung ke CPUExecutionProvider agar proses stabil dan VRAM GPU tetap bebas..."
            )
            session = new_session(model_name, providers=["CPUExecutionProvider"], **kwargs)
            self.current_session = session
            self.current_model = model_name
            self.current_provider = "cpu"
            logger.info(f"Model '{model_name}' berhasil dimuat di CPU.")
            return session, "cpu"

        vram_bytes = self.vram_limit_mb * 1024 * 1024
        cuda_options = {
            "device_id": 0,
            "gpu_mem_limit": vram_bytes,
            "arena_extend_strategy": "kSameAsRequested",
        }
        providers = [("CUDAExecutionProvider", cuda_options), "CPUExecutionProvider"]

        # Coba inisialisasi dengan CUDA Execution Provider
        try:
            logger.info(
                f"Menginisialisasi model '{model_name}' di GPU CUDA (VRAM Cap: {self.vram_limit_mb} MB)..."
            )
            session = new_session(model_name, providers=providers, **kwargs)
            self.current_session = session
            self.current_model = model_name
            self.current_provider = "cuda"
            logger.info(
                f"Model '{model_name}' siap di GPU CUDA (batas alokasi VRAM {self.vram_limit_mb} MB)."
            )
            return session, "cuda"
        except Exception as e:
            logger.warning(
                f"Inisialisasi CUDA gagal ({e}). Fallback otomatis ke CPUExecutionProvider..."
            )
            session = new_session(model_name, providers=["CPUExecutionProvider"], **kwargs)
            self.current_session = session
            self.current_model = model_name
            self.current_provider = "cpu"
            logger.info(f"Model '{model_name}' berhasil dimuat di CPU.")
            return session, "cpu"

    def fallback_to_cpu(self, model_name: str, **kwargs) -> BaseSession:
        logger.warning(
            f"Beralih sementara ke CPU untuk model '{model_name}' karena memori GPU penuh..."
        )
        self._unload_current()
        session = new_session(model_name, providers=["CPUExecutionProvider"], **kwargs)
        self.current_session = session
        self.current_model = model_name
        self.current_provider = "cpu"
        return session


def create_app(pool: VramManagedSessionPool) -> FastAPI:
    app = FastAPI(
        title="Rembg (VRAM Capped)",
        description=f"Rembg server with {pool.vram_limit_mb}MB CUDA VRAM limit for Local Chat",
        version=__version__,
        docs_url="/api",
    )

    app.add_middleware(
        CORSMiddleware,
        allow_credentials=False,
        allow_origins=["*"],
        allow_methods=["*"],
        allow_headers=["*"],
    )

    class CommonQueryParams:
        def __init__(
            self,
            model: str = Query(
                default="bria-rmbg",
                description="Model to use when processing image",
                pattern=r"(" + "|".join(sessions_names) + ")",
            ),
            a: bool = Query(default=False, description="Enable Alpha Matting"),
            af: int = Query(default=240, ge=0, le=255, description="Foreground Threshold"),
            ab: int = Query(default=10, ge=0, le=255, description="Background Threshold"),
            ae: int = Query(default=10, ge=0, description="Erode Structure Size"),
            om: bool = Query(default=False, description="Only Mask"),
            ppm: bool = Query(default=False, description="Post Process Mask"),
            dc: bool = Query(default=False, description="Decontaminate Edges"),
            vm: bool = Query(default=False, description="Refine Edges with ViTMatte"),
            bgc: Optional[str] = Query(default=None, description="Background Color"),
            extras: Optional[str] = Query(default=None, description="Extra parameters as JSON"),
        ):
            self.model = model
            self.a = a
            self.af = af
            self.ab = ab
            self.ae = ae
            self.om = om
            self.ppm = ppm
            self.dc = dc
            self.vm = vm
            self.extras = extras
            self.bgc = (
                cast(Tuple[int, int, int, int], tuple(map(int, bgc.split(","))))
                if bgc
                else None
            )

    class CommonQueryPostParams:
        def __init__(
            self,
            model: str = Form(
                default="bria-rmbg",
                description="Model to use when processing image",
                pattern=r"(" + "|".join(sessions_names) + ")",
            ),
            a: bool = Form(default=False, description="Enable Alpha Matting"),
            af: int = Form(default=240, ge=0, le=255, description="Foreground Threshold"),
            ab: int = Form(default=10, ge=0, le=255, description="Background Threshold"),
            ae: int = Form(default=10, ge=0, description="Erode Structure Size"),
            om: bool = Form(default=False, description="Only Mask"),
            ppm: bool = Form(default=False, description="Post Process Mask"),
            dc: bool = Form(default=False, description="Decontaminate Edges"),
            vm: bool = Form(default=False, description="Refine Edges with ViTMatte"),
            bgc: Optional[str] = Form(default=None, description="Background Color"),
            extras: Optional[str] = Form(default=None, description="Extra parameters as JSON"),
        ):
            self.model = model
            self.a = a
            self.af = af
            self.ab = ab
            self.ae = ae
            self.om = om
            self.ppm = ppm
            self.dc = dc
            self.vm = vm
            self.extras = extras
            self.bgc = (
                cast(Tuple[int, int, int, int], tuple(map(int, bgc.split(","))))
                if bgc
                else None
            )

    def process_image(content: bytes, commons: Union[CommonQueryParams, CommonQueryPostParams]) -> Response:
        kwargs = {}
        if commons.extras:
            try:
                kwargs.update(json.loads(commons.extras))
            except Exception:
                pass

        model_name = commons.model or "bria-rmbg"
        session, provider = pool.get_or_create_session(model_name, **kwargs)

        remove_kwargs = {
            "alpha_matting": commons.a,
            "alpha_matting_foreground_threshold": commons.af,
            "alpha_matting_background_threshold": commons.ab,
            "alpha_matting_erode_size": commons.ae,
            "only_mask": commons.om,
            "post_process_mask": commons.ppm,
            "decontaminate": commons.dc,
            "vitmatte": commons.vm,
            "bgcolor": commons.bgc,
            **kwargs,
        }

        try:
            output = remove(content, session=session, **remove_kwargs)
            return Response(output, media_type="image/png")
        except Exception as exc:
            if provider == "cuda":
                logger.warning(
                    f"Inferensi di GPU CUDA gagal ({exc}). Mengalihkan otomatis ke CPUExecutionProvider..."
                )
                try:
                    cpu_session = pool.fallback_to_cpu(model_name, **kwargs)
                    output = remove(content, session=cpu_session, **remove_kwargs)
                    return Response(output, media_type="image/png")
                except Exception as cpu_err:
                    logger.error(f"Inferensi fallback di CPU juga gagal: {cpu_err}")
                    raise cpu_err
            raise exc

    # Health check endpoints for Local Chat
    @app.head("/api")
    @app.head("/api/")
    @app.get("/api/health")
    @app.head("/api/health")
    async def health_check():
        return JSONResponse(
            content={
                "status": "online",
                "service": "rembg",
                "vram_limit_mb": pool.vram_limit_mb,
                "current_model": pool.current_model,
                "provider": pool.current_provider,
            }
        )

    # URL image processing endpoint
    @app.get(
        path="/api/remove",
        tags=["Background Removal"],
        summary="Remove from URL",
    )
    async def get_remove(
        url: str = Query(default=..., description="URL of the image"),
        commons: CommonQueryParams = Depends(),
    ):
        parsed = urlparse(url)
        if parsed.scheme not in ("http", "https"):
            raise HTTPException(status_code=400, detail="Only http and https URLs are allowed.")

        max_bytes = 50 * 1024 * 1024
        async with aiohttp.ClientSession() as client:
            async with client.get(url) as response:
                if response.status != 200:
                    raise HTTPException(status_code=400, detail="Failed to fetch image from URL.")
                file_bytes = await response.read()
                if len(file_bytes) > max_bytes:
                    raise HTTPException(status_code=400, detail="Image exceeds maximum size.")
                return await asyncify(process_image)(file_bytes, commons)

    # File upload processing endpoint (used by Local Chat)
    @app.post(
        path="/api/remove",
        tags=["Background Removal"],
        summary="Remove from Stream",
    )
    async def post_remove(
        file: bytes = File(default=..., description="Image byte stream"),
        commons: CommonQueryPostParams = Depends(),
    ):
        return await asyncify(process_image)(file, commons)

    return app


def parse_args():
    default_vram = int(os.environ.get("REMBG_VRAM_LIMIT_MB", "2048"))
    parser = argparse.ArgumentParser(
        description="Rembg Server with CUDA VRAM Capping for Local Chat"
    )
    parser.add_argument(
        "-p", "--port", type=int, default=7000, help="Port to listen on (default: 7000)"
    )
    parser.add_argument(
        "--host", type=str, default="127.0.0.1", help="Host to bind to (default: 127.0.0.1)"
    )
    parser.add_argument(
        "--vram-limit-mb",
        type=int,
        default=default_vram,
        help=f"Max VRAM in MB for CUDAExecutionProvider (default: {default_vram})",
    )
    parser.add_argument(
        "-l", "--log-level", type=str, default="info", help="Uvicorn log level (default: info)"
    )
    parser.add_argument(
        "--no-ui",
        action="store_true",
        default=True,
        help="Run without Gradio UI (default: True)",
    )
    return parser.parse_args()


def main():
    args = parse_args()
    logger.info("=" * 60)
    logger.info("  Memulai Server Rembg - Local Chat (VRAM Capped)")
    logger.info(f"  Host: http://{args.host}:{args.port}")
    logger.info(f"  VRAM Cap: {args.vram_limit_mb} MB (RTX 4060)")
    logger.info(f"  Policy: Single Active Model + Auto CPU Fallback")
    logger.info(f"  API Docs: http://{args.host}:{args.port}/api")
    logger.info("=" * 60)

    pool = VramManagedSessionPool(vram_limit_mb=args.vram_limit_mb)
    app = create_app(pool)

    uvicorn.run(
        app,
        host=args.host,
        port=args.port,
        log_level=args.log_level.lower(),
    )


if __name__ == "__main__":
    main()
