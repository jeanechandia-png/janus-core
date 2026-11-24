import { stripLinks } from './safety.js';

/**
 * Equipo que cuida a la niña (orden del Founder, 24-nov-2026): especialistas con nombre, especialidad, centro y contacto.
 * Lo escribe solo el tutor. Los datos viven en el estado privado del aparato (SQLite local), nunca en el repositorio.
 * La niña ve el nombre, una etiqueta amable y el centro; nunca teléfonos, correos, direcciones ni notas.
 */
export const CARE_SPECIALTIES = [
  'medico_general', 'pediatria', 'logopedia', 'lenguaje_tos', 'salud_mental_juvenil', 'psicologia',
  'dentista', 'ortodoncia', 'oftalmologia', 'fisioterapia', 'colegio', 'otro',
] as const;
export type CareSpecialty = (typeof CARE_SPECIALTIES)[number];

/** Etiqueta para el tutor. */
export const CARE_LABEL_PARENT: Record<CareSpecialty, string> = {
  medico_general: 'Médico de cabecera (huisarts)',
  pediatria: 'Pediatría',
  logopedia: 'Logopedia',
  lenguaje_tos: 'Lenguaje · TOS',
  salud_mental_juvenil: 'Salud mental juvenil (jeugd-ggz)',
  psicologia: 'Psicología',
  dentista: 'Dentista',
  ortodoncia: 'Ortodoncia',
  oftalmologia: 'Oftalmología',
  fisioterapia: 'Fisioterapia',
  colegio: 'Colegio (apoyo)',
  otro: 'Otro',
};

/** Etiqueta para la niña: amable y sin diagnósticos. */
export const CARE_LABEL_KID: Record<CareSpecialty, string> = {
  medico_general: 'Médico',
  pediatria: 'Médico',
  logopedia: 'Logopedia',
  lenguaje_tos: 'Logopedia',
  salud_mental_juvenil: 'Cita',
  psicologia: 'Cita',
  dentista: 'Dentista',
  ortodoncia: 'Dentista',
  oftalmologia: 'Ojos',
  fisioterapia: 'Fisio',
  colegio: 'Colegio',
  otro: 'Cita',
};

export interface CareProvider {
  id: string;
  name: string;
  specialty: CareSpecialty;
  organization?: string;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
}

/** Lo que ve la niña de cada especialista. */
export interface CareProviderKidView { id: string; name: string; label: string; organization?: string }

export const CARE_ID = /^care_[a-z0-9-]{6,40}$/;
export const CARE_CAP = 40;

export type CareValidation = { ok: true; provider: Omit<CareProvider, 'id'> } | { ok: false; message: string };

const clean = (value: unknown, max: number) => (typeof value === 'string' ? stripLinks(value).replace(/\s+/g, ' ').trim().slice(0, max) : '');

export function normalizeCareProviderInput(input: unknown): CareValidation {
  if (!input || typeof input !== 'object') return { ok: false, message: 'Datos no válidos.' };
  const raw = input as Record<string, unknown>;
  const name = clean(raw.name, 80);
  if (name.length < 2) return { ok: false, message: 'Escribe el nombre del especialista.' };
  const specialty = raw.specialty;
  if (typeof specialty !== 'string' || !(CARE_SPECIALTIES as readonly string[]).includes(specialty)) return { ok: false, message: 'Especialidad no válida.' };
  const organization = clean(raw.organization, 80);
  const phone = clean(raw.phone, 30);
  if (phone && !/^[+0-9 ()-]{6,30}$/.test(phone)) return { ok: false, message: 'El teléfono solo puede llevar números, espacios, +, - y paréntesis.' };
  // El correo no pasa por stripLinks: se valida tal cual y nunca se pinta como enlace en la app de la niña.
  const email = typeof raw.email === 'string' ? raw.email.trim().slice(0, 120) : '';
  if (email && !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]{2,}$/.test(email)) return { ok: false, message: 'El correo no es válido.' };
  const address = clean(raw.address, 160);
  const notes = clean(raw.notes, 300);
  return {
    ok: true,
    provider: {
      name,
      specialty: specialty as CareSpecialty,
      ...(organization ? { organization } : {}),
      ...(phone ? { phone } : {}),
      ...(email ? { email } : {}),
      ...(address ? { address } : {}),
      ...(notes ? { notes } : {}),
    },
  };
}

export function careKidView(providers: readonly CareProvider[]): CareProviderKidView[] {
  return providers.map((provider) => ({
    id: provider.id,
    name: provider.name,
    label: CARE_LABEL_KID[provider.specialty] ?? 'Cita',
    ...(provider.organization ? { organization: provider.organization } : {}),
  }));
}

/** Carga defensiva: descarta entradas rotas en lugar de romper el estado. */
export function sanitizeCareTeam(value: unknown): CareProvider[] {
  if (!Array.isArray(value)) return [];
  const out: CareProvider[] = [];
  for (const entry of value.slice(-CARE_CAP)) {
    if (!entry || typeof entry !== 'object' || !CARE_ID.test(String((entry as CareProvider).id))) continue;
    const checked = normalizeCareProviderInput(entry);
    if (checked.ok) out.push({ id: (entry as CareProvider).id, ...checked.provider });
  }
  return out;
}
