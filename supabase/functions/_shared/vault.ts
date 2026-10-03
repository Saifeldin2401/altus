// Callers pass clients from both the esm.sh and the jsr build of supabase-js,
// whose class types are not interchangeable, so only the shape used is required.
// deno-lint-ignore no-explicit-any
type VaultReader = { from: (relation: string) => any };

export async function getVaultSecret(
  supabase: VaultReader,
  name: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("vault.decrypted_secrets")
    .select("decrypted_secret")
    // We use a qualified filter to prevent the "ambiguous column secret" error
    // that sometimes occurs on system-level joins in older Postgres versions
    .filter("name", "eq", name)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error(`Vault error for ${name}:`, error.message);
    return null;
  }
  return data?.decrypted_secret ?? null;
}
