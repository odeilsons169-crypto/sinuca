// =====================================================
// CLIENTE API GERENCIANET/EFÍ - PIX E CARTÃO
// =====================================================

import https from 'https';
import fs from 'fs';
import path from 'path';
import { supabaseAdmin } from '../../services/supabase.js';

interface GerencianetConfig {
  clientId: string;
  clientSecret: string;
  certificatePath: string;
  environment: 'sandbox' | 'production';
  pixKey?: string;
}

interface PixChargeRequest {
  calendario: { expiracao: number };
  devedor?: { cpf: string; nome: string };
  valor: { original: string };
  chave: string;
  solicitacaoPagador?: string;
  infoAdicionais?: Array<{ nome: string; valor: string }>;
}

interface PixChargeResponse {
  txid: string;
  calendario: { criacao: string; expiracao: number };
  revisao: number;
  loc: { id: number; location: string; tipoCob: string };
  location: string;
  status: string;
  devedor?: { cpf: string; nome: string };
  valor: { original: string };
  chave: string;
  pixCopiaECola?: string;
  qrcode?: string;
}

interface CardChargeRequest {
  items: Array<{ name: string; value: number; amount: number }>;
  payment: {
    credit_card: {
      customer: { name: string; cpf: string; email: string; phone_number?: string };
      installments: number;
      payment_token: string;
      billing_address?: {
        street: string;
        number: string;
        neighborhood: string;
        zipcode: string;
        city: string;
        state: string;
      };
    };
  };
}

class GerencianetClient {
  private config: GerencianetConfig | null = null;
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;

  private get baseUrl(): string {
    if (!this.config) return '';
    return this.config.environment === 'production'
      ? 'https://pix.api.efipay.com.br'
      : 'https://pix-h.api.efipay.com.br';
  }

  private get baseUrlCard(): string {
    if (!this.config) return '';
    return this.config.environment === 'production'
      ? 'https://api.gerencianet.com.br'
      : 'https://sandbox.gerencianet.com.br';
  }

  // Carregar configurações do banco
  async loadConfig(): Promise<boolean> {
    try {
      const { data } = await supabaseAdmin
        .from('payment_settings')
        .select('*')
        .eq('is_active', true)
        .single();

      if (!data || !data.client_id || !data.client_secret) {
        console.warn('[Gerencianet] Configurações não encontradas ou incompletas');
        return false;
      }

      this.config = {
        clientId: data.client_id,
        clientSecret: data.client_secret,
        certificatePath: data.certificate_path || '',
        environment: data.environment as 'sandbox' | 'production',
        pixKey: data.pix_key,
      };

      return true;
    } catch (error) {
      console.error('[Gerencianet] Erro ao carregar config:', error);
      return false;
    }
  }

  // Obter token de acesso OAuth2
  private async getAccessToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    if (!this.config) {
      throw new Error('Configurações não carregadas');
    }

    const credentials = Buffer.from(
      `${this.config.clientId}:${this.config.clientSecret}`
    ).toString('base64');

    const options: https.RequestOptions = {
      hostname: this.baseUrl.replace('https://', ''),
      path: '/oauth/token',
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/json',
      },
    };

    // Adicionar certificado se disponível
    if (this.config.certificatePath && fs.existsSync(this.config.certificatePath)) {
      const cert = fs.readFileSync(this.config.certificatePath);
      (options as any).pfx = cert;
      (options as any).passphrase = '';
    }

    return new Promise((resolve, reject) => {
      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            const response = JSON.parse(data);
            if (response.access_token) {
              this.accessToken = response.access_token;
              this.tokenExpiry = Date.now() + (response.expires_in - 60) * 1000;
              resolve(this.accessToken!);
            } else {
              reject(new Error(response.error_description || 'Erro ao obter token'));
            }
          } catch (e) {
            reject(e);
          }
        });
      });

      req.on('error', reject);
      req.write(JSON.stringify({ grant_type: 'client_credentials' }));
      req.end();
    });
  }

  // Fazer requisição autenticada
  private async request<T>(
    method: string,
    endpoint: string,
    body?: any,
    isPix: boolean = true
  ): Promise<T> {
    const token = await this.getAccessToken();
    const baseUrl = isPix ? this.baseUrl : this.baseUrlCard;

    const url = new URL(endpoint, baseUrl);
    
    const options: https.RequestOptions = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    };

    // Adicionar certificado para Pix
    if (isPix && this.config?.certificatePath && fs.existsSync(this.config.certificatePath)) {
      const cert = fs.readFileSync(this.config.certificatePath);
      (options as any).pfx = cert;
      (options as any).passphrase = '';
    }

    return new Promise((resolve, reject) => {
      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            const response = JSON.parse(data);
            if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
              resolve(response);
            } else {
              reject(new Error(response.mensagem || response.error_description || 'Erro na API'));
            }
          } catch (e) {
            reject(e);
          }
        });
      });

      req.on('error', reject);
      if (body) req.write(JSON.stringify(body));
      req.end();
    });
  }

  // ==================== PIX ====================

  // Criar cobrança Pix
  async createPixCharge(params: {
    value: number;
    payerCpf?: string;
    payerName?: string;
    description?: string;
    expirationSeconds?: number;
  }): Promise<{
    txid: string;
    qrcode: string;
    copyPaste: string;
    expiresAt: string;
  }> {
    if (!this.config) await this.loadConfig();
    if (!this.config?.pixKey) {
      throw new Error('Chave Pix não configurada');
    }

    const txid = this.generateTxId();
    const expiration = params.expirationSeconds || 3600; // 1 hora padrão

    const chargeData: PixChargeRequest = {
      calendario: { expiracao: expiration },
      valor: { original: params.value.toFixed(2) },
      chave: this.config.pixKey,
      solicitacaoPagador: params.description || 'Compra de créditos - Sinuca Online',
    };

    if (params.payerCpf && params.payerName) {
      chargeData.devedor = {
        cpf: params.payerCpf.replace(/\D/g, ''),
        nome: params.payerName,
      };
    }

    const response = await this.request<PixChargeResponse>(
      'PUT',
      `/v2/cob/${txid}`,
      chargeData
    );

    // Buscar QR Code
    const qrResponse = await this.request<{ qrcode: string; imagemQrcode: string }>(
      'GET',
      `/v2/loc/${response.loc.id}/qrcode`
    );

    const expiresAt = new Date(Date.now() + expiration * 1000).toISOString();

    return {
      txid: response.txid,
      qrcode: qrResponse.imagemQrcode,
      copyPaste: qrResponse.qrcode,
      expiresAt,
    };
  }

  // Consultar cobrança Pix
  async getPixCharge(txid: string): Promise<PixChargeResponse> {
    if (!this.config) await this.loadConfig();
    return this.request<PixChargeResponse>('GET', `/v2/cob/${txid}`);
  }

  // Gerar TxID único
  private generateTxId(): string {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let txid = '';
    for (let i = 0; i < 35; i++) {
      txid += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return txid;
  }

  // ==================== CARTÃO ====================

  // Criar cobrança com cartão
  async createCardCharge(params: {
    value: number;
    paymentToken: string;
    customer: {
      name: string;
      cpf: string;
      email: string;
      phone?: string;
    };
    installments?: number;
  }): Promise<{ chargeId: number; status: string; total: number }> {
    if (!this.config) await this.loadConfig();

    // 1. Criar cobrança
    const chargeResponse = await this.request<{ data: { charge_id: number } }>(
      'POST',
      '/v1/charge',
      {
        items: [
          {
            name: 'Créditos Sinuca Online',
            value: Math.round(params.value * 100), // Em centavos
            amount: 1,
          },
        ],
      },
      false
    );

    const chargeId = chargeResponse.data.charge_id;

    // 2. Pagar com cartão
    const payResponse = await this.request<{ data: { charge_id: number; status: string; total: number } }>(
      'POST',
      `/v1/charge/${chargeId}/pay`,
      {
        payment: {
          credit_card: {
            customer: {
              name: params.customer.name,
              cpf: params.customer.cpf.replace(/\D/g, ''),
              email: params.customer.email,
              phone_number: params.customer.phone?.replace(/\D/g, ''),
            },
            installments: params.installments || 1,
            payment_token: params.paymentToken,
          },
        },
      },
      false
    );

    return {
      chargeId: payResponse.data.charge_id,
      status: payResponse.data.status,
      total: payResponse.data.total,
    };
  }

  // ==================== WEBHOOK ====================

  // Configurar webhook
  async configureWebhook(webhookUrl: string): Promise<boolean> {
    if (!this.config) await this.loadConfig();
    if (!this.config?.pixKey) return false;

    try {
      await this.request('PUT', `/v2/webhook/${this.config.pixKey}`, {
        webhookUrl,
      });
      return true;
    } catch (error) {
      console.error('[Gerencianet] Erro ao configurar webhook:', error);
      return false;
    }
  }

  // Verificar se está configurado
  async isConfigured(): Promise<boolean> {
    const loaded = await this.loadConfig();
    return loaded && !!this.config?.clientId && !!this.config?.clientSecret;
  }
}

export const gerencianetClient = new GerencianetClient();
