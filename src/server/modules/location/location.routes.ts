import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { supabaseAdmin } from '../../services/supabase.js';

export async function locationRoutes(fastify: FastifyInstance) {
  // GET /location/countries - Listar países disponíveis
  fastify.get('/countries', async (request: FastifyRequest, reply: FastifyReply) => {
    const { data, error } = await supabaseAdmin
      .from('available_countries')
      .select('*')
      .eq('is_active', true)
      .order('name_pt');

    if (error) {
      return reply.status(500).send({ error: error.message });
    }

    return reply.send({ countries: data });
  });

  // GET /location/states/:countryCode - Listar estados de um país
  fastify.get('/states/:countryCode', async (request: FastifyRequest<{ Params: { countryCode: string } }>, reply: FastifyReply) => {
    const { countryCode } = request.params;
    const code = countryCode.toUpperCase();

    let tableName = '';
    if (code === 'BR') {
      tableName = 'states_br';
    } else if (code === 'US') {
      tableName = 'states_us';
    } else {
      return reply.status(400).send({ error: 'País não suportado ainda' });
    }

    const { data, error } = await supabaseAdmin
      .from(tableName)
      .select('*')
      .order('name');

    if (error) {
      return reply.status(500).send({ error: error.message });
    }

    return reply.send({ states: data });
  });

  // Mapa de bandeiras por código de país
  fastify.get('/flag/:countryCode', async (request: FastifyRequest<{ Params: { countryCode: string } }>, reply: FastifyReply) => {
    const { countryCode } = request.params;
    const code = countryCode.toUpperCase();

    const flags: Record<string, string> = {
      'BR': '🇧🇷',
      'US': '🇺🇸',
      'AR': '🇦🇷',
      'MX': '🇲🇽',
      'PT': '🇵🇹',
      'ES': '🇪🇸',
      'FR': '🇫🇷',
      'DE': '🇩🇪',
      'IT': '🇮🇹',
      'GB': '🇬🇧',
      'CA': '🇨🇦',
      'JP': '🇯🇵',
      'CN': '🇨🇳',
      'KR': '🇰🇷',
    };

    return reply.send({ 
      code,
      flag: flags[code] || '🏳️'
    });
  });
}
