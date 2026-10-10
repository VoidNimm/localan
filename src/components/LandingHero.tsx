import { Sparkles } from 'lucide-react'
import type { Project } from '../types/project'

export interface LandingHeroProps {
  landingUiReady: boolean
  activeProject: Project | null
  greeting: string
}

export function LandingHero({ landingUiReady, activeProject, greeting }: LandingHeroProps) {
  return (
    <div
      className={`flex-1 flex flex-col items-center justify-start pt-[18vh] text-center px-4 transition-all duration-700 ease-out select-none ${
        landingUiReady ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
      }`}
    >
      {activeProject && (
        <div className="mb-3 px-3 py-1 rounded-full bg-orange-600/20 border border-orange-500/30 text-orange-300 text-xs inline-flex items-center gap-1.5 backdrop-blur-sm">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Project: {activeProject.name}</span>
        </div>
      )}
      <h1 
        className="text-3xl sm:text-5xl lg:text-6xl font-light text-white tracking-tight leading-tight max-w-2xl text-balance"
        style={{ textShadow: '0 4px 32px rgba(0,0,0,0.8), 0 1px 2px rgba(0,0,0,0.4)' }}
      >
        {activeProject
          ? `Explore with ${activeProject.name}`
          : greeting}
      </h1>
    </div>
  )
}
