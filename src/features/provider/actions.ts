"use server";

import { createClient } from "@/lib/supabase/server";
import { getProviderForUser } from "@/lib/provider";
import { revalidatePath } from "next/cache";

export async function createBranchAction(formData: FormData): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const membership = await getProviderForUser(supabase, user.id);
  if (!membership) return;

  const name = formData.get("name") as string;
  const address = formData.get("address") as string;
  const city = formData.get("city") as string;
  const state = formData.get("state") as string;
  const phone = (formData.get("phone") as string) || null;
  const email = (formData.get("email") as string) || null;

  if (!name?.trim() || !address?.trim() || !city?.trim() || !state?.trim()) return;

  const { error } = await supabase.from("provider_branches").insert({
    provider_id: membership.provider_id,
    name: name.trim(),
    address: address.trim(),
    city: city.trim(),
    state: state.trim(),
    phone: phone?.trim() || null,
    email: email?.trim() || null,
  });

  if (!error) {
    revalidatePath("/provider/dashboard");
    revalidatePath("/provider/dashboard/branches");
  }
}

export async function createServiceAction(formData: FormData): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const membership = await getProviderForUser(supabase, user.id);
  if (!membership) return;

  const name = formData.get("name") as string;
  const description = (formData.get("description") as string) || null;
  const category_id = formData.get("category_id") as string;
  const branch_id = (formData.get("branch_id") as string) || null;
  const duration_minutes = parseInt(formData.get("duration_minutes") as string, 10) || 30;
  const price = parseFloat(formData.get("price") as string);
  const requires_referral = formData.get("requires_referral") === "on";
  const preparation_notes = (formData.get("preparation_notes") as string) || null;

  if (!name?.trim() || !category_id) return;
  if (!Number.isFinite(price) || price < 0) return;

  const { error } = await supabase.from("services").insert({
    provider_id: membership.provider_id,
    branch_id: branch_id || null,
    category_id,
    name: name.trim(),
    description: description?.trim() || null,
    preparation_notes: preparation_notes?.trim() || null,
    duration_minutes: Math.max(1, duration_minutes),
    price,
    currency: "NGN",
    requires_referral,
  });

  if (!error) {
    revalidatePath("/provider/dashboard");
    revalidatePath("/provider/dashboard/services");
  }
}

export async function createSlotsAction(formData: FormData): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const membership = await getProviderForUser(supabase, user.id);
  if (!membership) return;

  const service_id = formData.get("service_id") as string;
  const branch_id = formData.get("branch_id") as string;
  const date = formData.get("date") as string;
  const start_time = formData.get("start_time") as string;
  const end_time = formData.get("end_time") as string;
  const capacity = parseInt(formData.get("capacity") as string, 10) || 1;

  if (!service_id || !branch_id || !date || !start_time || !end_time) return;

  const start = new Date(`${date}T${start_time}`);
  const end = new Date(`${date}T${end_time}`);
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) return;

  const { error } = await supabase.from("availability_slots").insert({
    service_id,
    provider_id: membership.provider_id,
    branch_id,
    start_time: start.toISOString(),
    end_time: end.toISOString(),
    capacity: Math.max(1, capacity),
    status: "available",
  });

  if (!error) {
    revalidatePath("/provider/dashboard");
    revalidatePath("/provider/dashboard/availability");
  }
}
