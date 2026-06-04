"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Category = "Pizze Rosse" | "Pizze Bianche";

interface Pizza {
  id: string;
  name: string;
  description: string;
  category: Category;
  price_cents: number;
  nightly_cap: number;
  allergens: string[];
  is_active: boolean;
  is_special: boolean;
  sort_order: number;
  image_url: string | null;
}

const BLANK: Omit<Pizza, "id"> = {
  name: "", description: "", category: "Pizze Rosse",
  price_cents: 0, nightly_cap: 20, allergens: [],
  is_active: true, is_special: false, sort_order: 0,
  image_url: null,
};

const ALLERGEN_OPTIONS = ["Gluten", "Dairy", "Eggs", "Nuts", "Soy", "Shellfish", "Sesame"];
const CATEGORIES: Category[] = ["Pizze Rosse", "Pizze Bianche"];

const inputStyle: React.CSSProperties = {
  padding: "9px 12px", borderRadius: 8, border: "1px solid #F8EAD520",
  background: "#3A3E43", color: "#F8EAD5", fontSize: 14,
  fontFamily: "var(--font-archivo), sans-serif", outline: "none", width: "100%",
};
const labelStyle: React.CSSProperties = {
  fontSize: 12, fontWeight: 700, color: "#F8EAD577", letterSpacing: 0.8,
  textTransform: "uppercase", marginBottom: 4, display: "block",
};

export function MenuClient({ initialPizzas }: { initialPizzas: Pizza[] }) {
  const supabase = createClient();
  const [pizzas, setPizzas] = useState<Pizza[]>(initialPizzas);
  const [editing, setEditing] = useState<Pizza | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pendingImage, setPendingImage] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const grouped = CATEGORIES.map((cat) => ({
    category: cat,
    items: pizzas.filter((p) => p.category === cat).sort((a, b) => a.sort_order - b.sort_order),
  }));

  function openNew() {
    const maxSort = Math.max(0, ...pizzas.map((p) => p.sort_order));
    setEditing({ id: "", ...BLANK, sort_order: maxSort + 10 });
    setIsNew(true);
    setPendingImage(null);
    setUploadError(null);
  }

  function openEdit(pizza: Pizza) {
    setEditing({ ...pizza });
    setIsNew(false);
    setPendingImage(null);
    setUploadError(null);
  }

  async function uploadImage(file: File, pizzaId: string): Promise<string> {
    const form = new FormData();
    form.append("file", file);
    form.append("pizzaId", pizzaId);
    const res = await fetch("/api/admin/upload-pizza-image", { method: "POST", body: form });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? "Upload failed");
    return json.publicUrl as string;
  }

  async function save() {
    if (!editing) return;
    setSaving(true);
    setUploadError(null);

    try {
      if (isNew) {
        const { data } = await supabase.from("pizzas").insert({
          name: editing.name, description: editing.description,
          category: editing.category, price_cents: editing.price_cents,
          nightly_cap: editing.nightly_cap, allergens: editing.allergens,
          is_active: editing.is_active, is_special: editing.is_special,
          sort_order: editing.sort_order, image_url: null,
        }).select().single();

        if (data) {
          let imageUrl: string | null = null;
          if (pendingImage) {
            imageUrl = await uploadImage(pendingImage, data.id);
            await supabase.from("pizzas").update({ image_url: imageUrl }).eq("id", data.id);
          }
          setPizzas((prev) => [...prev, { ...data, image_url: imageUrl } as Pizza]);
        }
      } else {
        let imageUrl = editing.image_url;
        if (pendingImage) {
          imageUrl = await uploadImage(pendingImage, editing.id);
        }
        await supabase.from("pizzas").update({
          name: editing.name, description: editing.description,
          category: editing.category, price_cents: editing.price_cents,
          nightly_cap: editing.nightly_cap, allergens: editing.allergens,
          is_active: editing.is_active, is_special: editing.is_special,
          sort_order: editing.sort_order, image_url: imageUrl,
        }).eq("id", editing.id);
        setPizzas((prev) => prev.map((p) => p.id === editing.id ? { ...editing, image_url: imageUrl } : p));
      }

      setEditing(null);
      setPendingImage(null);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(pizza: Pizza) {
    await supabase.from("pizzas").update({ is_active: !pizza.is_active }).eq("id", pizza.id);
    setPizzas((prev) => prev.map((p) => p.id === pizza.id ? { ...p, is_active: !p.is_active } : p));
  }

  async function toggleSpecial(pizza: Pizza) {
    await supabase.from("pizzas").update({ is_special: !pizza.is_special }).eq("id", pizza.id);
    setPizzas((prev) => prev.map((p) => p.id === pizza.id ? { ...p, is_special: !p.is_special } : p));
  }

  async function moveSort(pizza: Pizza, dir: -1 | 1) {
    const catPizzas = pizzas.filter((p) => p.category === pizza.category).sort((a, b) => a.sort_order - b.sort_order);
    const idx = catPizzas.findIndex((p) => p.id === pizza.id);
    const swapIdx = idx + dir;
    if (swapIdx < 0 || swapIdx >= catPizzas.length) return;

    const a = catPizzas[idx];
    const b = catPizzas[swapIdx];
    await supabase.from("pizzas").update({ sort_order: b.sort_order }).eq("id", a.id);
    await supabase.from("pizzas").update({ sort_order: a.sort_order }).eq("id", b.id);
    setPizzas((prev) => prev.map((p) => {
      if (p.id === a.id) return { ...p, sort_order: b.sort_order };
      if (p.id === b.id) return { ...p, sort_order: a.sort_order };
      return p;
    }));
  }

  const previewSrc = pendingImage
    ? URL.createObjectURL(pendingImage)
    : editing?.image_url ?? null;

  return (
    <div style={{ paddingTop: 32, maxWidth: 800 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
        <h1 className="font-display" style={{ fontSize: 28, fontWeight: 900, margin: 0 }}>Menu</h1>
        <button onClick={openNew} style={{ background: "#2F7D4F", border: "none", color: "#F8EAD5", borderRadius: 10, padding: "10px 20px", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "var(--font-archivo), sans-serif" }}>
          + Add pizza
        </button>
      </div>

      {/* Pizza list */}
      {grouped.map(({ category, items }) => (
        <div key={category} style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase", color: "#2F7D4F", margin: "0 0 12px" }}>
            {category}
          </h2>
          <div style={{ display: "grid", gap: 8 }}>
            {items.map((pizza, idx) => (
              <div key={pizza.id} style={{ background: "#484D52", border: "1px solid #F8EAD510", borderRadius: 12, padding: "14px 16px", display: "flex", alignItems: "flex-start", gap: 12, opacity: pizza.is_active ? 1 : 0.5, position: "relative" }}>
                {/* Sort arrows */}
                <div style={{ display: "flex", flexDirection: "column", gap: 2, flexShrink: 0, paddingTop: 2 }}>
                  <button onClick={() => moveSort(pizza, -1)} disabled={idx === 0} style={{ background: "transparent", border: "none", color: idx === 0 ? "#F8EAD522" : "#F8EAD555", cursor: idx === 0 ? "default" : "pointer", fontSize: 12, padding: "1px 4px" }}>▲</button>
                  <button onClick={() => moveSort(pizza, 1)} disabled={idx === items.length - 1} style={{ background: "transparent", border: "none", color: idx === items.length - 1 ? "#F8EAD522" : "#F8EAD555", cursor: idx === items.length - 1 ? "default" : "pointer", fontSize: 12, padding: "1px 4px" }}>▼</button>
                </div>

                {/* Thumbnail */}
                {pizza.image_url && (
                  <div style={{ width: 44, height: 44, borderRadius: 8, overflow: "hidden", flexShrink: 0, background: "#3A3E43" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={pizza.image_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  </div>
                )}

                {/* Info + actions */}
                <div style={{ flex: 1, minWidth: 0, paddingRight: 28 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontWeight: 700, fontSize: 15, color: "#F8EAD5" }}>{pizza.name}</span>
                    <span style={{ fontSize: 14, color: "#2F7D4F", fontWeight: 700 }}>${(pizza.price_cents / 100).toFixed(0)}</span>
                    {pizza.is_special && <span style={{ fontSize: 11, fontWeight: 700, background: "#E8C24A", color: "#484D52", borderRadius: 100, padding: "2px 8px" }}>Special</span>}
                    {!pizza.is_active && <span style={{ fontSize: 11, fontWeight: 700, color: "#F8EAD544", border: "1px solid #F8EAD520", borderRadius: 100, padding: "2px 8px" }}>Hidden</span>}
                    <span style={{ fontSize: 12, color: "#F8EAD544" }}>Cap: {pizza.nightly_cap}</span>
                  </div>
                  {pizza.description && <div style={{ fontSize: 13, color: "#F8EAD566", marginTop: 2 }}>{pizza.description}</div>}
                  <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                    <button onClick={() => toggleActive(pizza)} style={{ background: "transparent", border: "1px solid #F8EAD520", color: "#F8EAD566", borderRadius: 7, padding: "5px 10px", fontSize: 12, cursor: "pointer", fontFamily: "var(--font-archivo), sans-serif" }}>
                      {pizza.is_active ? "Hide" : "Show"}
                    </button>
                    <button onClick={() => openEdit(pizza)} style={{ background: "transparent", border: "1px solid #F8EAD520", color: "#F8EAD5", borderRadius: 7, padding: "5px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "var(--font-archivo), sans-serif" }}>
                      Edit
                    </button>
                  </div>
                </div>

                {/* Special star — upper right */}
                <button
                  onClick={() => toggleSpecial(pizza)}
                  title="Toggle special"
                  style={{ position: "absolute", top: 10, right: 12, background: "transparent", border: "none", fontSize: 18, color: pizza.is_special ? "#E8C24A" : "#F8EAD522", cursor: "pointer", padding: 0, lineHeight: 1 }}
                >
                  ★
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Edit / Add modal */}
      {editing && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.7)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div style={{ background: "#3A3E43", borderRadius: 20, padding: 28, width: "100%", maxWidth: 520, maxHeight: "90vh", overflowY: "auto" }}>
            <h3 className="font-display" style={{ fontSize: 22, fontWeight: 900, margin: "0 0 22px", color: "#F8EAD5" }}>
              {isNew ? "Add pizza" : "Edit pizza"}
            </h3>

            <div style={{ display: "grid", gap: 14 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={labelStyle}>Name</label>
                  <input style={inputStyle} value={editing.name} onChange={(e) => setEditing((p) => p && ({ ...p, name: e.target.value }))} />
                </div>
                <div>
                  <label style={labelStyle}>Category</label>
                  <select style={{ ...inputStyle }} value={editing.category} onChange={(e) => setEditing((p) => p && ({ ...p, category: e.target.value as Category }))}>
                    {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label style={labelStyle}>Description</label>
                <input style={inputStyle} value={editing.description} onChange={(e) => setEditing((p) => p && ({ ...p, description: e.target.value }))} />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                <div>
                  <label style={labelStyle}>Price ($)</label>
                  <input type="number" min="0" step="0.5" style={inputStyle} value={(editing.price_cents / 100).toFixed(2)} onChange={(e) => setEditing((p) => p && ({ ...p, price_cents: Math.round(parseFloat(e.target.value) * 100) || 0 }))} />
                </div>
                <div>
                  <label style={labelStyle}>Nightly cap</label>
                  <input type="number" min="1" style={inputStyle} value={editing.nightly_cap} onChange={(e) => setEditing((p) => p && ({ ...p, nightly_cap: parseInt(e.target.value) || 1 }))} />
                </div>
                <div>
                  <label style={labelStyle}>Sort order</label>
                  <input type="number" style={inputStyle} value={editing.sort_order} onChange={(e) => setEditing((p) => p && ({ ...p, sort_order: parseInt(e.target.value) || 0 }))} />
                </div>
              </div>

              {/* Allergens */}
              <div>
                <label style={labelStyle}>Allergens</label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {ALLERGEN_OPTIONS.map((a) => {
                    const checked = editing.allergens.includes(a);
                    return (
                      <button key={a} type="button" onClick={() => setEditing((p) => p && ({ ...p, allergens: checked ? p.allergens.filter((x) => x !== a) : [...p.allergens, a] }))}
                        style={{ background: checked ? "#2F7D4F22" : "transparent", border: `1px solid ${checked ? "#2F7D4F" : "#F8EAD520"}`, color: checked ? "#2F7D4F" : "#F8EAD566", borderRadius: 100, padding: "5px 12px", fontSize: 13, cursor: "pointer", fontFamily: "var(--font-archivo), sans-serif" }}>
                        {a}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Toggles */}
              <div style={{ display: "flex", gap: 20 }}>
                {[{ label: "Active", key: "is_active" }, { label: "This week's special", key: "is_special" }].map(({ label, key }) => (
                  <label key={key} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 14, color: "#F8EAD5" }}>
                    <input type="checkbox" checked={(editing as unknown as Record<string, boolean>)[key]} onChange={(e) => setEditing((p) => p && ({ ...p, [key]: e.target.checked }))} />
                    {label}
                  </label>
                ))}
              </div>

              {/* Image upload */}
              <div>
                <label style={labelStyle}>Pizza image</label>
                {previewSrc && (
                  <div style={{ marginBottom: 10, borderRadius: 10, overflow: "hidden", height: 130, position: "relative", background: "#484D52" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={previewSrc} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center" }} />
                  </div>
                )}
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) setPendingImage(file);
                  }}
                  style={{ ...inputStyle, padding: "8px 12px", cursor: "pointer" }}
                />
                {uploadError && (
                  <p style={{ fontSize: 12, color: "#E05555", marginTop: 6 }}>{uploadError}</p>
                )}
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 22 }}>
              <button onClick={() => { setEditing(null); setPendingImage(null); }} style={{ flex: 1, background: "transparent", border: "1px solid #F8EAD520", color: "#F8EAD566", borderRadius: 10, padding: "12px", fontSize: 14, cursor: "pointer", fontFamily: "var(--font-archivo), sans-serif" }}>Cancel</button>
              <button onClick={save} disabled={saving || !editing.name} style={{ flex: 2, background: saving || !editing.name ? "#2F7D4F55" : "#2F7D4F", border: "none", color: "#F8EAD5", borderRadius: 10, padding: "12px", fontSize: 14, fontWeight: 700, cursor: saving || !editing.name ? "not-allowed" : "pointer", fontFamily: "var(--font-archivo), sans-serif" }}>
                {saving ? "Saving…" : isNew ? "Add pizza" : "Save changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
