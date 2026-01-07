// =====================================================
// SERVIÇO DE CONFIGURAÇÕES DE PAGAMENTO (ADMIN)
// =====================================================

import { supabaseAdmin } from '../../services/supabase.js';
import fs from 'fs';
import path from 'path';

export interface PaymentSettingsData {
  environment: 'sandbox' | 'production';
  clientId: string;
  clientSecret: string;
  pixKey?: string;
  webhookUrl?: string;
  isActive: boolean;
  certificateUploaded: boolean;
  certificateUploadedAt?: string;
}

class PaymentSettingsService {
  private readonly CERTIFICATES_DIR = path.join(process.cwd(), 'certificates');

  constructor() {
    // Criar diretório de certificados se não existir
    if (!fs.existsSync(this.CERTIFICATES_DIR)) {
      fs.mkdirSync(this.CERTIFICATES_DIR, { recursive: true });
    }
  }

  // Obter configurações atuais
  async getSettings(): Promise<PaymentSettingsData | null> {
    const { data } = await supabaseAdmin
      .from('payment_settings')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!data) return null;

    return {
      environment: data.environment,
      clientId: data.client_id ? '••••••••' + data.client_id.slice(-4) : '',
      clientSecret: data.client_secret ? '••••••••' : '',
      pixKey: data.pix_key || '',
      webhookUrl: data.webhook_url || '',
      isActive: data.is_active,
      certificateUploaded: !!data.certificate_path,
      certificateUploadedAt: data.certificate_uploaded_at,
    };
  }

  // Atualizar credenciais
  async updateCredentials(params: {
    environment: 'sandbox' | 'production';
    clientId: string;
    clientSecret: string;
    pixKey?: string;
    webhookUrl?: string;
    adminId: string;
  }): Promise<{ success: boolean; error?: string }> {
    try {
      // Buscar configuração existente
      const { data: existing } = await supabaseAdmin
        .from('payment_settings')
        .select('id')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      const updateData: any = {
        environment: params.environment,
        client_id: params.clientId,
        client_secret: params.clientSecret,
        pix_key: params.pixKey || null,
        webhook_url: params.webhookUrl || null,
        updated_at: new Date().toISOString(),
      };

      if (existing) {
        await supabaseAdmin
          .from('payment_settings')
          .update(updateData)
          .eq('id', existing.id);
      } else {
        await supabaseAdmin
          .from('payment_settings')
          .insert(updateData);
      }

      // Log de auditoria
      await supabaseAdmin.from('admin_logs').insert({
        admin_id: params.adminId,
        action: 'update_payment_settings',
        target_type: 'payment_settings',
        target_id: existing?.id || 'new',
        details: { environment: params.environment, hasClientId: !!params.clientId },
      });

      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  // Upload de certificado .p12
  async uploadCertificate(
    fileBuffer: Buffer,
    filename: string,
    adminId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Validar extensão
      if (!filename.endsWith('.p12') && !filename.endsWith('.pem')) {
        return { success: false, error: 'Arquivo deve ser .p12 ou .pem' };
      }

      // Gerar nome único
      const uniqueName = `cert_${Date.now()}_${filename}`;
      const filePath = path.join(this.CERTIFICATES_DIR, uniqueName);

      // Salvar arquivo
      fs.writeFileSync(filePath, fileBuffer);

      // Atualizar banco
      const { data: existing } = await supabaseAdmin
        .from('payment_settings')
        .select('id, certificate_path')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      // Remover certificado antigo se existir
      if (existing?.certificate_path && fs.existsSync(existing.certificate_path)) {
        fs.unlinkSync(existing.certificate_path);
      }

      const updateData = {
        certificate_path: filePath,
        certificate_uploaded_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      if (existing) {
        await supabaseAdmin
          .from('payment_settings')
          .update(updateData)
          .eq('id', existing.id);
      } else {
        await supabaseAdmin
          .from('payment_settings')
          .insert({
            ...updateData,
            environment: 'sandbox',
            is_active: false,
          });
      }

      // Log de auditoria
      await supabaseAdmin.from('admin_logs').insert({
        admin_id: adminId,
        action: 'upload_certificate',
        target_type: 'payment_settings',
        target_id: existing?.id || 'new',
        details: { filename },
      });

      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  // Ativar/desativar integração
  async setActive(active: boolean, adminId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { data: existing } = await supabaseAdmin
        .from('payment_settings')
        .select('id, client_id, client_secret, certificate_path')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (!existing) {
        return { success: false, error: 'Configurações não encontradas' };
      }

      // Validar se pode ativar
      if (active) {
        if (!existing.client_id || !existing.client_secret) {
          return { success: false, error: 'Client ID e Client Secret são obrigatórios' };
        }
        if (!existing.certificate_path || !fs.existsSync(existing.certificate_path)) {
          return { success: false, error: 'Certificado .p12 é obrigatório' };
        }
      }

      await supabaseAdmin
        .from('payment_settings')
        .update({ is_active: active, updated_at: new Date().toISOString() })
        .eq('id', existing.id);

      await supabaseAdmin.from('admin_logs').insert({
        admin_id: adminId,
        action: active ? 'activate_payments' : 'deactivate_payments',
        target_type: 'payment_settings',
        target_id: existing.id,
        details: { active },
      });

      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  // Testar conexão com API
  async testConnection(): Promise<{ success: boolean; error?: string }> {
    try {
      const { data } = await supabaseAdmin
        .from('payment_settings')
        .select('*')
        .eq('is_active', true)
        .single();

      if (!data || !data.client_id || !data.client_secret) {
        return { success: false, error: 'Configurações incompletas' };
      }

      // Aqui faria uma chamada de teste para a API do Gerencianet
      // Por enquanto, apenas valida se as credenciais existem
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }
}

export const paymentSettingsService = new PaymentSettingsService();
