import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";

const card = {
  background: "#fff",
  border: "1px solid #e2e8f0",
  borderRadius: 14,
  padding: 20,
  boxShadow: "0 2px 8px rgba(15,23,42,.04)",
};

const button = {
  background: "#0284c7",
  color: "white",
  border: 0,
  borderRadius: 8,
  padding: "10px 16px",
  cursor: "pointer",
  fontWeight: 600,
};

const input = {
  padding: 10,
  border: "1px solid #cbd5e1",
  borderRadius: 8,
  width: "100%",
  boxSizing: "border-box",
};

function getStockStatus(medicine) {
  if (medicine.stock_quantity === null || medicine.stock_quantity === undefined) {
    return { label: "Not Set", color: "#64748b", bg: "#f1f5f9" };
  }

  const quantity = Number(medicine.stock_quantity);
  const threshold = Number(medicine.low_stock_threshold ?? 5);

  if (quantity <= 0) {
    return { label: "Out of Stock", color: "#b91c1c", bg: "#fee2e2" };
  }

  if (quantity <= threshold) {
    return { label: "Low Stock", color: "#b45309", bg: "#fef3c7" };
  }

  return { label: "In Stock", color: "#15803d", bg: "#dcfce7" };
}

export default function MedicineStockView() {
  const [medicines, setMedicines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [drafts, setDrafts] = useState({});
  const [search, setSearch] = useState("");

  const loadStock = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const { data: authData, error: authError } =
        await supabase.auth.getUser();

      if (authError || !authData.user) {
        throw new Error("Please log in again.");
      }

      const { data, error: queryError } = await supabase
        .from("medication_schedules")
        .select(
          "id,medicine_name,dosage,frequency,times,stock_quantity,stock_unit,low_stock_threshold,is_active"
        )
        .eq("patient_id", authData.user.id)
        .eq("is_active", true)
        .order("medicine_name", { ascending: true });

      if (queryError) throw queryError;

      setMedicines(data || []);

      const initialDrafts = {};

      (data || []).forEach((medicine) => {
        initialDrafts[medicine.id] = {
          quantity: medicine.stock_quantity ?? "",
          threshold: medicine.low_stock_threshold ?? 5,
        };
      });

      setDrafts(initialDrafts);
    } catch (err) {
      setError(err.message || "Unable to load medicine stock.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStock();
  }, [loadStock]);

  const metrics = useMemo(() => {
    const statuses = medicines.map(getStockStatus);

    return {
      total: medicines.length,
      inStock: statuses.filter((s) => s.label === "In Stock").length,
      lowStock: statuses.filter((s) => s.label === "Low Stock").length,
      outOfStock: statuses.filter((s) => s.label === "Out of Stock").length,
      notSet: statuses.filter((s) => s.label === "Not Set").length,
    };
  }, [medicines]);

  const filteredMedicines = useMemo(
    () =>
      medicines.filter((medicine) =>
        medicine.medicine_name
          ?.toLowerCase()
          .includes(search.trim().toLowerCase())
      ),
    [medicines, search]
  );

  function updateDraft(id, field, value) {
    setDrafts((previous) => ({
      ...previous,
      [id]: {
        ...previous[id],
        [field]: value,
      },
    }));
  }

  async function saveStock(medicine, mode) {
    const draft = drafts[medicine.id];

    if (!draft) return;

    const enteredQuantity = String(draft.quantity).trim();
    const enteredThreshold = String(draft.threshold).trim();

    if (
      enteredQuantity === "" ||
      enteredThreshold === "" ||
      !Number.isFinite(Number(enteredQuantity)) ||
      !Number.isFinite(Number(enteredThreshold)) ||
      Number(enteredQuantity) < 0 ||
      Number(enteredThreshold) < 0
    ) {
      setError("Enter valid non-negative stock and threshold values.");
      return;
    }

    try {
      setSavingId(medicine.id);
      setError("");
      setMessage("");

      const { data: authData, error: authError } =
        await supabase.auth.getUser();

      if (authError || !authData.user) {
        throw new Error("Please log in again.");
      }

      const quantity =
        mode === "refill"
          ? Number(medicine.stock_quantity ?? 0) +
            Number(enteredQuantity)
          : Number(enteredQuantity);

      const { data, error: updateError } = await supabase
        .from("medication_schedules")
        .update({
          stock_quantity: quantity,
          low_stock_threshold: Number(enteredThreshold),
        })
        .eq("id", medicine.id)
        .eq("patient_id", authData.user.id)
        .select("id");

      if (updateError) throw updateError;

      if (!data?.length) {
        throw new Error("Stock update was not saved.");
      }

      setMessage(
        `${medicine.medicine_name}: stock updated successfully.`
      );

      await loadStock();
    } catch (err) {
      setError(err.message || "Unable to update stock.");
    } finally {
      setSavingId(null);
    }
  }

  if (loading && medicines.length === 0) {
    return <div style={{ padding: 24 }}>Loading medicine inventory...</div>;
  }

  return (
    <div style={{ padding: "12px 4px 32px", maxWidth: 1200, margin: "auto" }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ marginBottom: 8 }}>Medicine Stock Management</h1>
        <p style={{ color: "#64748b" }}>
          Monitor medicine availability, manage refills and prevent stockouts.
        </p>
      </div>

      {error && (
        <div style={{ ...card, background: "#fee2e2", marginBottom: 16 }}>
          {error}
        </div>
      )}

      {message && (
        <div style={{ ...card, background: "#dcfce7", marginBottom: 16 }}>
          {message}
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))",
          gap: 16,
          marginBottom: 24,
        }}
      >
        {[
          ["Total Medicines", metrics.total, "#0284c7"],
          ["In Stock", metrics.inStock, "#16a34a"],
          ["Low Stock", metrics.lowStock, "#d97706"],
          ["Out of Stock", metrics.outOfStock, "#dc2626"],
        ].map(([label, value, color]) => (
          <div key={label} style={card}>
            <p style={{ color: "#64748b", margin: 0 }}>{label}</p>
            <h2 style={{ color, fontSize: 32, marginBottom: 0 }}>
              {value}
            </h2>
          </div>
        ))}
      </div>

      {metrics.notSet > 0 && (
        <p style={{ color: "#64748b", marginBottom: 16 }}>
          {metrics.notSet} medicine(s) have no stock quantity set.
        </p>
      )}

      <div style={{ ...card, marginBottom: 20 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <h2 style={{ margin: 0 }}>Medicine Inventory</h2>

          <button style={button} onClick={loadStock}>
            Refresh Stock
          </button>
        </div>

        <input
          style={{ ...input, marginTop: 18 }}
          placeholder="Search medicines..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>

      {filteredMedicines.length === 0 ? (
        <div style={card}>
          <p>
            {medicines.length === 0
              ? "No active medicines found. Add medicines from Medicine Schedule."
              : "No medicines match your search."}
          </p>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 16 }}>
          {filteredMedicines.map((medicine) => {
            const status = getStockStatus(medicine);
            const draft = drafts[medicine.id] || {};

            return (
              <div key={medicine.id} style={card}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    flexWrap: "wrap",
                    gap: 12,
                  }}
                >
                  <div>
                    <h3 style={{ margin: "0 0 6px" }}>
                      {medicine.medicine_name}
                    </h3>
                    <p style={{ color: "#64748b", margin: 0 }}>
                      {medicine.dosage} • {medicine.frequency}
                    </p>
                  </div>

                  <span
                    style={{
                      color: status.color,
                      background: status.bg,
                      padding: "7px 12px",
                      borderRadius: 20,
                      fontWeight: 600,
                      fontSize: 13,
                    }}
                  >
                    {status.label}
                  </span>
                </div>

                <p style={{ marginTop: 18 }}>
                  <strong>Current Stock:</strong>{" "}
                  {medicine.stock_quantity ?? "Not Set"}{" "}
                  {medicine.stock_unit || "units"}
                </p>

                <p>
                  <strong>Low Stock Alert At:</strong>{" "}
                  {medicine.low_stock_threshold ?? 5}
                </p>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "repeat(auto-fit,minmax(180px,1fr))",
                    gap: 14,
                    marginTop: 18,
                  }}
                >
                  <label>
                    <span style={{ display: "block", marginBottom: 6 }}>
                      Quantity
                    </span>

                    <input
                      type="number"
                      min="0"
                      step="any"
                      style={input}
                      value={draft.quantity ?? ""}
                      onChange={(event) =>
                        updateDraft(
                          medicine.id,
                          "quantity",
                          event.target.value
                        )
                      }
                    />
                  </label>

                  <label>
                    <span style={{ display: "block", marginBottom: 6 }}>
                      Alert Threshold
                    </span>

                    <input
                      type="number"
                      min="0"
                      step="any"
                      style={input}
                      value={draft.threshold ?? ""}
                      onChange={(event) =>
                        updateDraft(
                          medicine.id,
                          "threshold",
                          event.target.value
                        )
                      }
                    />
                  </label>
                </div>

                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 10,
                    marginTop: 18,
                  }}
                >
                  <button
                    style={button}
                    disabled={savingId !== null}
                    onClick={() => saveStock(medicine, "set")}
                  >
                    {savingId === medicine.id
                      ? "Saving..."
                      : "Set Stock"}
                  </button>

                  <button
                    style={{
                      ...button,
                      background: "#0f766e",
                    }}
                    disabled={savingId !== null}
                    onClick={() => saveStock(medicine, "refill")}
                  >
                    Add Refill
                  </button>
                </div>

                <p style={{ fontSize: 12, color: "#64748b" }}>
                  Set Stock replaces the current quantity. Add Refill
                  adds the entered quantity to the existing stock.
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}