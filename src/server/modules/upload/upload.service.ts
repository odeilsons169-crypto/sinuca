import { supabaseAdmin } from '../../services/supabase.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Diretório de uploads
const UPLOADS_DIR = path.join(__dirname, '../../../uploads');
const AVATARS_DIR = path.join(UPLOADS_DIR, 'avatars');

// Configurações
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const AVATAR_SIZES = { small: 64, medium: 128, large: 256 };

class UploadService {
  constructor() {
    this.ensureDirectories();
  }

  // Garantir que diretórios existem
  private ensureDirectories() {
    if (!fs.existsSync(UPLOADS_DIR)) {
      fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    }
    if (!fs.existsSync(AVATARS_DIR)) {
      fs.mkdirSync(AVATARS_DIR, { recursive: true });
    }
  }

  // Gerar nome único para arquivo
  private generateFileName(userId: string, extension: string): string {
    const hash = crypto.randomBytes(8).toString('hex');
    return `${userId}_${hash}${extension}`;
  }

  // Validar arquivo
  validateFile(file: { mimetype: string; size: number }): { valid: boolean; error?: string } {
    if (!ALLOWED_TYPES.includes(file.mimetype)) {
      return { valid: false, error: 'Tipo de arquivo não permitido. Use JPG, PNG, WebP ou GIF.' };
    }

    if (file.size > MAX_FILE_SIZE) {
      return { valid: false, error: 'Arquivo muito grande. Máximo 5MB.' };
    }

    return { valid: true };
  }

  // Upload de avatar
  async uploadAvatar(
    userId: string,
    fileBuffer: Buffer,
    mimetype: string,
    originalName: string
  ): Promise<{ success: boolean; url?: string; error?: string }> {
    try {
      // Validar
      const validation = this.validateFile({ mimetype, size: fileBuffer.length });
      if (!validation.valid) {
        return { success: false, error: validation.error };
      }

      // Extensão do arquivo
      const ext = path.extname(originalName) || this.getExtensionFromMime(mimetype);
      const fileName = this.generateFileName(userId, ext);
      const filePath = path.join(AVATARS_DIR, fileName);

      // Deletar avatar antigo
      await this.deleteOldAvatar(userId);

      // Salvar arquivo
      fs.writeFileSync(filePath, fileBuffer);

      // URL do avatar
      const avatarUrl = `/uploads/avatars/${fileName}`;

      // Atualizar usuário no banco
      await supabaseAdmin
        .from('users')
        .update({ avatar_url: avatarUrl, updated_at: new Date().toISOString() })
        .eq('id', userId);

      // Registrar metadados
      await supabaseAdmin.from('files_metadata').insert({
        user_id: userId,
        file_type: 'avatar',
        file_name: fileName,
        file_path: avatarUrl,
        mime_type: mimetype,
        file_size: fileBuffer.length,
      });

      return { success: true, url: avatarUrl };
    } catch (err: any) {
      console.error('Erro no upload:', err);
      return { success: false, error: 'Erro ao fazer upload do arquivo' };
    }
  }

  // Deletar avatar antigo
  private async deleteOldAvatar(userId: string): Promise<void> {
    try {
      // Buscar avatar atual
      const { data: user } = await supabaseAdmin
        .from('users')
        .select('avatar_url')
        .eq('id', userId)
        .single();

      if (user?.avatar_url && user.avatar_url.startsWith('/uploads/')) {
        const oldPath = path.join(__dirname, '../../..', user.avatar_url);
        if (fs.existsSync(oldPath)) {
          fs.unlinkSync(oldPath);
        }

        // Remover metadados
        await supabaseAdmin
          .from('files_metadata')
          .delete()
          .eq('user_id', userId)
          .eq('file_type', 'avatar');
      }
    } catch (err) {
      console.error('Erro ao deletar avatar antigo:', err);
    }
  }

  // Deletar avatar
  async deleteAvatar(userId: string): Promise<{ success: boolean; error?: string }> {
    try {
      await this.deleteOldAvatar(userId);

      // Limpar URL no banco
      await supabaseAdmin
        .from('users')
        .update({ avatar_url: null, updated_at: new Date().toISOString() })
        .eq('id', userId);

      return { success: true };
    } catch (err: any) {
      return { success: false, error: 'Erro ao deletar avatar' };
    }
  }

  // Obter extensão do mimetype
  private getExtensionFromMime(mimetype: string): string {
    const map: Record<string, string> = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/webp': '.webp',
      'image/gif': '.gif',
    };
    return map[mimetype] || '.jpg';
  }

  // Obter avatar URL
  async getAvatarUrl(userId: string): Promise<string | null> {
    const { data } = await supabaseAdmin
      .from('users')
      .select('avatar_url')
      .eq('id', userId)
      .single();

    return data?.avatar_url || null;
  }
}

export const uploadService = new UploadService();
