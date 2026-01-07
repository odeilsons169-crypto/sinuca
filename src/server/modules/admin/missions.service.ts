// =====================================================
// SERVIÇO DE MISSÕES E COMPETIÇÕES
// =====================================================

import { supabaseAdmin } from '../../services/supabase.js';

export interface Mission {
  id: string;
  title: string;
  description?: string;
  type: 'daily' | 'weekly' | 'special' | 'achievement';
  requirement_type: 'wins' | 'matches' | 'streak' | 'points' | 'deposit' | 'invite';
  requirement_value: number;
  reward_type: 'credits' | 'bonus_balance' | 'vip_days';
  reward_value: number;
  icon: string;
  is_active: boolean;
  start_date?: string;
  end_date?: string;
  max_completions?: number;
  current_completions: number;
  created_at: string;
}

export interface UserMission {
  id: string;
  user_id: string;
  mission_id: string;
  progress: number;
  is_completed: boolean;
  completed_at?: string;
  reward_claimed: boolean;
  claimed_at?: string;
  mission?: Mission;
}

class MissionsService {
  // ==================== ADMIN ====================

  // Listar todas as missões (admin)
  async listAll(): Promise<Mission[]> {
    const { data, error } = await supabaseAdmin
      .from('missions')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  // Criar missão
  async create(params: {
    title: string;
    description?: string;
    type: Mission['type'];
    requirement_type: Mission['requirement_type'];
    requirement_value: number;
    reward_type: Mission['reward_type'];
    reward_value: number;
    icon?: string;
    start_date?: string;
    end_date?: string;
    max_completions?: number;
    adminId: string;
  }): Promise<{ success: boolean; mission?: Mission; error?: string }> {
    const { data, error } = await supabaseAdmin
      .from('missions')
      .insert({
        title: params.title,
        description: params.description,
        type: params.type,
        requirement_type: params.requirement_type,
        requirement_value: params.requirement_value,
        reward_type: params.reward_type,
        reward_value: params.reward_value,
        icon: params.icon || '🎯',
        start_date: params.start_date,
        end_date: params.end_date,
        max_completions: params.max_completions,
        created_by: params.adminId,
      })
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    await supabaseAdmin.from('admin_logs').insert({
      admin_id: params.adminId,
      action: 'create_mission',
      target_type: 'mission',
      target_id: data.id,
      details: { title: params.title, type: params.type, reward_value: params.reward_value },
    });

    return { success: true, mission: data };
  }

  // Atualizar missão
  async update(missionId: string, params: Partial<Mission>, adminId: string): Promise<{ success: boolean; error?: string }> {
    const { error } = await supabaseAdmin
      .from('missions')
      .update({
        ...params,
        updated_at: new Date().toISOString(),
      })
      .eq('id', missionId);

    if (error) {
      return { success: false, error: error.message };
    }

    await supabaseAdmin.from('admin_logs').insert({
      admin_id: adminId,
      action: 'update_mission',
      target_type: 'mission',
      target_id: missionId,
      details: params,
    });

    return { success: true };
  }

  // Desativar missão
  async deactivate(missionId: string, adminId: string): Promise<{ success: boolean; error?: string }> {
    const { error } = await supabaseAdmin
      .from('missions')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', missionId);

    if (error) {
      return { success: false, error: error.message };
    }

    await supabaseAdmin.from('admin_logs').insert({
      admin_id: adminId,
      action: 'deactivate_mission',
      target_type: 'mission',
      target_id: missionId,
    });

    return { success: true };
  }

  // Toggle ativar/desativar missão
  async toggleActive(missionId: string, isActive: boolean, adminId: string): Promise<{ success: boolean; error?: string }> {
    const { error } = await supabaseAdmin
      .from('missions')
      .update({ is_active: isActive, updated_at: new Date().toISOString() })
      .eq('id', missionId);

    if (error) {
      return { success: false, error: error.message };
    }

    await supabaseAdmin.from('admin_logs').insert({
      admin_id: adminId,
      action: isActive ? 'activate_mission' : 'deactivate_mission',
      target_type: 'mission',
      target_id: missionId,
    });

    return { success: true };
  }

  // Deletar missão permanentemente
  async deleteMission(missionId: string, adminId: string): Promise<{ success: boolean; error?: string }> {
    // Primeiro deletar progressos dos usuários
    await supabaseAdmin
      .from('user_missions')
      .delete()
      .eq('mission_id', missionId);

    // Deletar a missão
    const { error } = await supabaseAdmin
      .from('missions')
      .delete()
      .eq('id', missionId);

    if (error) {
      return { success: false, error: error.message };
    }

    await supabaseAdmin.from('admin_logs').insert({
      admin_id: adminId,
      action: 'delete_mission',
      target_type: 'mission',
      target_id: missionId,
    });

    return { success: true };
  }

  // ==================== USUÁRIO ====================

  // Obter missões disponíveis para o usuário
  async getAvailableForUser(userId: string): Promise<(Mission & { progress: number; is_completed: boolean; reward_claimed: boolean })[]> {
    const now = new Date().toISOString();

    // Buscar missões ativas
    const { data: missions } = await supabaseAdmin
      .from('missions')
      .select('*')
      .eq('is_active', true)
      .or(`start_date.is.null,start_date.lte.${now}`)
      .or(`end_date.is.null,end_date.gte.${now}`);

    if (!missions || missions.length === 0) return [];

    // Buscar progresso do usuário
    const { data: userMissions } = await supabaseAdmin
      .from('user_missions')
      .select('*')
      .eq('user_id', userId)
      .in('mission_id', missions.map(m => m.id));

    const progressMap = new Map(userMissions?.map(um => [um.mission_id, um]) || []);

    return missions.map(mission => {
      const userProgress = progressMap.get(mission.id);
      return {
        ...mission,
        progress: userProgress?.progress || 0,
        is_completed: userProgress?.is_completed || false,
        reward_claimed: userProgress?.reward_claimed || false,
      };
    });
  }

  // Atualizar progresso de missão
  async updateProgress(userId: string, requirementType: Mission['requirement_type'], increment: number = 1): Promise<void> {
    const now = new Date().toISOString();

    // Buscar missões ativas do tipo
    const { data: missions } = await supabaseAdmin
      .from('missions')
      .select('*')
      .eq('is_active', true)
      .eq('requirement_type', requirementType)
      .or(`start_date.is.null,start_date.lte.${now}`)
      .or(`end_date.is.null,end_date.gte.${now}`);

    if (!missions || missions.length === 0) return;

    for (const mission of missions) {
      // Verificar se missão atingiu limite de completações
      if (mission.max_completions && mission.current_completions >= mission.max_completions) {
        continue;
      }

      // Buscar ou criar progresso do usuário
      const { data: existing } = await supabaseAdmin
        .from('user_missions')
        .select('*')
        .eq('user_id', userId)
        .eq('mission_id', mission.id)
        .single();

      if (existing) {
        // Se já completou e reclamou, pular (exceto missões diárias que resetam)
        if (existing.is_completed && existing.reward_claimed) {
          // Para missões diárias, verificar se é um novo dia
          if (mission.type === 'daily') {
            const completedDate = new Date(existing.completed_at!).toDateString();
            const today = new Date().toDateString();
            if (completedDate === today) continue;
            
            // Resetar para novo dia
            await supabaseAdmin
              .from('user_missions')
              .update({
                progress: increment,
                is_completed: increment >= mission.requirement_value,
                completed_at: increment >= mission.requirement_value ? now : null,
                reward_claimed: false,
                claimed_at: null,
                updated_at: now,
              })
              .eq('id', existing.id);
          }
          continue;
        }

        // Atualizar progresso
        const newProgress = existing.progress + increment;
        const isCompleted = newProgress >= mission.requirement_value;

        await supabaseAdmin
          .from('user_missions')
          .update({
            progress: newProgress,
            is_completed: isCompleted,
            completed_at: isCompleted && !existing.is_completed ? now : existing.completed_at,
            updated_at: now,
          })
          .eq('id', existing.id);
      } else {
        // Criar novo progresso
        const isCompleted = increment >= mission.requirement_value;

        await supabaseAdmin
          .from('user_missions')
          .insert({
            user_id: userId,
            mission_id: mission.id,
            progress: increment,
            is_completed: isCompleted,
            completed_at: isCompleted ? now : null,
          });
      }
    }
  }

  // Reclamar recompensa
  async claimReward(userId: string, missionId: string): Promise<{ success: boolean; reward?: { type: string; value: number }; error?: string }> {
    // Buscar progresso
    const { data: userMission, error: umError } = await supabaseAdmin
      .from('user_missions')
      .select('*, mission:missions(*)')
      .eq('user_id', userId)
      .eq('mission_id', missionId)
      .single();

    if (umError || !userMission) {
      return { success: false, error: 'Missão não encontrada' };
    }

    if (!userMission.is_completed) {
      return { success: false, error: 'Missão ainda não foi completada' };
    }

    if (userMission.reward_claimed) {
      return { success: false, error: 'Recompensa já foi reclamada' };
    }

    const mission = userMission.mission as Mission;

    // Dar recompensa
    if (mission.reward_type === 'credits') {
      // Adicionar créditos
      await supabaseAdmin
        .from('credits')
        .update({ 
          amount: supabaseAdmin.rpc('increment_credits', { user_id: userId, amount: mission.reward_value })
        })
        .eq('user_id', userId);

      // Fallback: update direto
      const { data: credits } = await supabaseAdmin
        .from('credits')
        .select('amount')
        .eq('user_id', userId)
        .single();

      if (credits) {
        await supabaseAdmin
          .from('credits')
          .update({ amount: credits.amount + mission.reward_value })
          .eq('user_id', userId);
      }
    } else if (mission.reward_type === 'bonus_balance') {
      // Adicionar saldo bônus
      await supabaseAdmin.rpc('add_bonus_balance', {
        p_user_id: userId,
        p_amount: mission.reward_value,
        p_description: `Recompensa: ${mission.title}`,
      });
    }

    // Marcar como reclamada
    await supabaseAdmin
      .from('user_missions')
      .update({
        reward_claimed: true,
        claimed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', userMission.id);

    // Incrementar contador de completações da missão
    await supabaseAdmin
      .from('missions')
      .update({ current_completions: mission.current_completions + 1 })
      .eq('id', missionId);

    return {
      success: true,
      reward: { type: mission.reward_type, value: mission.reward_value },
    };
  }

  // Estatísticas de missão (admin)
  async getStats(missionId: string): Promise<{
    total_started: number;
    total_completed: number;
    total_claimed: number;
    completion_rate: number;
  }> {
    const { data } = await supabaseAdmin
      .from('user_missions')
      .select('is_completed, reward_claimed')
      .eq('mission_id', missionId);

    if (!data || data.length === 0) {
      return { total_started: 0, total_completed: 0, total_claimed: 0, completion_rate: 0 };
    }

    const completed = data.filter(um => um.is_completed).length;
    const claimed = data.filter(um => um.reward_claimed).length;

    return {
      total_started: data.length,
      total_completed: completed,
      total_claimed: claimed,
      completion_rate: data.length > 0 ? (completed / data.length) * 100 : 0,
    };
  }
}

export const missionsService = new MissionsService();
