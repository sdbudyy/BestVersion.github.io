import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { useSkillsStore } from './skills';

interface ProgressState {
  overallProgress: number;
  completedSkills: number;
  totalSkills: number;
  documentedExperiences: number;
  totalExperiences: number;
  supervisorApprovals: number;
  totalApprovals: number;
  lastUpdated: string;
  loading: boolean;
  initialized: boolean;
  lastFetched: number | null;
  updateProgress: (force?: boolean) => Promise<void>;
  initialize: (force?: boolean) => Promise<void>;
  setupRealtimeSubscriptions: () => Promise<void>;
  clearState: () => void;
  loadProgress: () => Promise<void>;
}

export const useProgressStore = create<ProgressState>((set, get) => ({
  overallProgress: 0,
  completedSkills: 0,
  totalSkills: 22, // Total number of skills required
  documentedExperiences: 0,
  totalExperiences: 24, // Total number of experiences required
  supervisorApprovals: 0,
  totalApprovals: 24, // Total number of approvals required
  lastUpdated: new Date().toISOString(),
  loading: false,
  initialized: false,
  lastFetched: null,

  loadProgress: async () => {
    await get().updateProgress(true);
  },

  clearState: () => set({
    overallProgress: 0,
    completedSkills: 0,
    documentedExperiences: 0,
    supervisorApprovals: 0,
    lastUpdated: new Date().toISOString(),
    loading: false,
    initialized: false,
    lastFetched: null
  }),

  setupRealtimeSubscriptions: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Subscribe to experiences changes
    const experiencesSubscription = supabase
      .channel('experiences-changes')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'experiences',
          filter: `eit_id=eq.${user.id}`
        }, 
        () => {
          console.log('📝 Experience change detected, updating progress...');
          get().updateProgress();
        }
      )
      .subscribe();

    // Subscribe to skills changes
    const skillsSubscription = supabase
      .channel('skills-changes')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'skills',
          filter: `eit_id=eq.${user.id}`
        }, 
        () => {
          console.log('🎯 Skill change detected, updating progress...');
          get().updateProgress();
        }
      )
      .subscribe();

    // Store cleanup function in a variable but don't return it
    const cleanup = () => {
      experiencesSubscription.unsubscribe();
      skillsSubscription.unsubscribe();
    };

    // Add cleanup to window unload
    window.addEventListener('unload', cleanup);
  },

  initialize: async (force = false) => {
    if (get().loading) return;
    const now = Date.now();
    const lastFetched = get().lastFetched;
    if (!force && lastFetched && now - lastFetched < 5 * 60 * 1000) {
      return;
    }
    set({ loading: true });
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user found');

      // First, ensure skills are loaded
      const skillsStore = useSkillsStore.getState();
      if (skillsStore.skillCategories.length === 0) {
        await skillsStore.loadUserSkills();
        // Wait a bit to ensure skills are processed
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      // Get skills progress from skills store
      const completedSkills = skillsStore.skillCategories.reduce((acc, category) => {
        return acc + category.skills.filter(skill => skill.rank !== undefined).length;
      }, 0);

      // Fetch documented experiences
      const { data: experiences, error: experiencesError } = await supabase
        .from('experiences')
        .select('*')
        .eq('eit_id', user.id);

      if (experiencesError) throw experiencesError;

      // Fetch supervisor approvals
      const { data: approvals, error: approvalsError } = await supabase
        .from('experiences')
        .select('*')
        .eq('eit_id', user.id)
        .eq('supervisor_approved', true);

      if (approvalsError) throw approvalsError;

      // Calculate overall progress
      const skillsProgress = completedSkills / 22;
      const experiencesProgress = (experiences?.length || 0) / 24;
      const approvalsProgress = (approvals?.length || 0) / 24;
      const overallProgress = Math.round(((skillsProgress + experiencesProgress + approvalsProgress) / 3) * 100);

      console.log('Progress initialization calculation:', {
        completedSkills,
        skillsProgress,
        experiencesProgress,
        approvalsProgress,
        overallProgress
      });

      // Update state with all progress data
      set({
        overallProgress,
        completedSkills,
        totalSkills: 22,
        documentedExperiences: experiences?.length || 0,
        totalExperiences: 24,
        supervisorApprovals: approvals?.length || 0,
        totalApprovals: 24,
        lastUpdated: new Date().toISOString(),
        lastFetched: now,
        loading: false,
        initialized: true
      });

    } catch (error) {
      console.error('Error initializing progress:', error);
      set({ loading: false, initialized: false });
      throw error;
    }
  },

  updateProgress: async (force = false) => {
    if (get().loading) return;
    const now = Date.now();
    const lastFetched = get().lastFetched;
    if (!force && lastFetched && now - lastFetched < 5 * 60 * 1000) {
      return;
    }
    set({ loading: true });
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user found');

      // First, ensure skills are loaded
      const skillsStore = useSkillsStore.getState();
      if (skillsStore.skillCategories.length === 0) {
        await skillsStore.loadUserSkills();
        // Wait a bit to ensure skills are processed
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      // Get skills progress from skills store
      const completedSkills = skillsStore.skillCategories.reduce((acc, category) => {
        return acc + category.skills.filter(skill => skill.rank !== undefined).length;
      }, 0);

      // Fetch documented experiences
      const { data: experiences, error: experiencesError } = await supabase
        .from('experiences')
        .select('*')
        .eq('eit_id', user.id);

      if (experiencesError) throw experiencesError;

      // Fetch supervisor approvals
      const { data: approvals, error: approvalsError } = await supabase
        .from('experiences')
        .select('*')
        .eq('eit_id', user.id)
        .eq('supervisor_approved', true);

      if (approvalsError) throw approvalsError;

      // Calculate overall progress
      const skillsProgress = completedSkills / 22;
      const experiencesProgress = (experiences?.length || 0) / 24;
      const approvalsProgress = (approvals?.length || 0) / 24;
      const overallProgress = Math.round(((skillsProgress + experiencesProgress + approvalsProgress) / 3) * 100);

      console.log('Progress update calculation:', {
        completedSkills,
        skillsProgress,
        experiencesProgress,
        approvalsProgress,
        overallProgress
      });

      set({
        overallProgress,
        completedSkills,
        documentedExperiences: experiences?.length || 0,
        supervisorApprovals: approvals?.length || 0,
        lastUpdated: new Date().toISOString(),
        loading: false,
        lastFetched: now,
        initialized: true
      });
    } catch (error) {
      console.error('Error updating progress:', error);
      set({ loading: false, initialized: false });
    }
  }
}));