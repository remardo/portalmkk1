import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

const envSchema = z.object({
  SUPABASE_URL: z.url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  ADMIN_EMAIL: z.email(),
  ADMIN_PASSWORD: z.string().min(8),
  ADMIN_FULL_NAME: z.string().min(2).default("System Admin"),
  ADMIN_OFFICE_ID: z.coerce.number().int().positive().nullable().optional(),
});

const env = envSchema.parse(process.env);

const supabaseAdmin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function run() {
  const { data: existingAuthUsers, error: listError } = await supabaseAdmin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });

  if (listError) {
    throw new Error(`Failed to list users: ${listError.message}`);
  }

  const existing = existingAuthUsers.users.find((user) => user.email?.toLowerCase() === env.ADMIN_EMAIL.toLowerCase());
  if (existing) {
    const { error: profileError } = await supabaseAdmin.from("profiles").upsert({
      id: existing.id,
      full_name: env.ADMIN_FULL_NAME,
      role: "admin",
      office_id: env.ADMIN_OFFICE_ID ?? null,
      email: env.ADMIN_EMAIL,
    });

    if (profileError) {
      throw new Error(`Failed to upsert profile for existing user: ${profileError.message}`);
    }

    console.log(`Admin already exists and profile synced: ${env.ADMIN_EMAIL}`);
    return;
  }

  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email: env.ADMIN_EMAIL,
    password: env.ADMIN_PASSWORD,
    email_confirm: true,
    user_metadata: {
      full_name: env.ADMIN_FULL_NAME,
      role: "admin",
      office_id: env.ADMIN_OFFICE_ID ?? null,
    },
  });

  if (error || !data.user) {
    throw new Error(error?.message ?? "Failed to create admin user");
  }

  const { error: profileError } = await supabaseAdmin.from("profiles").upsert({
    id: data.user.id,
    full_name: env.ADMIN_FULL_NAME,
    role: "admin",
    office_id: env.ADMIN_OFFICE_ID ?? null,
    email: env.ADMIN_EMAIL,
  });

  if (profileError) {
    throw new Error(`Failed to create admin profile: ${profileError.message}`);
  }

  console.log(`Admin user created: ${env.ADMIN_EMAIL}`);
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
