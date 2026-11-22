import { useEffect, useRef, useState } from "react";
import type { FormEvent, InputHTMLAttributes } from "react";
import {
  demoMode,
  getOrders,
  getProducts,
  getSettings,
  isAdmin,
  saveProduct,
  saveSettings,
  signIn,
  signOut,
  updateOrder,
  uploadImage,
} from "./data";
import type {
  MeetingPoint,
  Order,
  OrderStatus,
  Product,
  Settings,
} from "./types";
import "./admin.css";

const money = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
});
const date = new Intl.DateTimeFormat("es-MX", {
  dateStyle: "medium",
  timeStyle: "short",
});
const stockLabels = {
  available: "Disponible",
  reserved: "Apartada",
  sold: "Vendida",
};
const orderLabels: Record<OrderStatus, string> = {
  awaiting_payment: "Por verificar pago",
  confirmed: "Confirmado",
  delivered: "Entregado",
  cancelled: "Cancelado",
  expired: "Apartado vencido",
};
const emptyProduct = (): Product => ({
  id: crypto.randomUUID(),
  name: "",
  description: "",
  category: "",
  condition: "Como nueva",
  size: "",
  color: "",
  price: 0,
  images: [],
  brand: "",
  measurements: "",
  material: "",
  status: "available",
});
function errorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (/invalid login|invalid credentials/i.test(message))
    return "Revisa tu correo y contraseña.";
  if (/failed to fetch|network|timeout/i.test(message))
    return "No pudimos conectar. Revisa tu conexión e inténtalo de nuevo.";
  if (
    /^[¡¿A-ZÁÉÍÓÚÑa-záéíóúñ]/.test(message) &&
    /[áéíóúñ¿¡]|\b(el|la|no se|sin|debes|para|pedido|prenda)\b/i.test(message)
  )
    return message;
  return "No pudimos completar la operación. Actualiza los datos y vuelve a intentarlo.";
}
function Field({
  label,
  wide,
  ...props
}: { label: string; wide?: boolean } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className={"admin-field" + (wide ? " full" : "")}>
      {label}
      <input {...props} />
    </label>
  );
}

async function optimizeImage(file: File): Promise<File> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
    throw new Error("Elige una foto JPG, PNG o WebP.");
  if (file.size > 20 * 1024 * 1024)
    throw new Error("Elige una foto de menos de 20 MB.");
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const scale = Math.min(
      1,
      1400 / Math.max(img.naturalWidth, img.naturalHeight),
    );
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("No se pudo procesar la foto.");
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/webp", 0.82),
    );
    if (!blob) throw new Error("No se pudo guardar la foto.");
    return new File([blob], "prenda.webp", { type: blob.type });
  } finally {
    URL.revokeObjectURL(url);
  }
}

function ProductEditor({
  initial,
  onClose,
  onSave,
}: {
  initial: Product;
  onClose: () => void;
  onSave: () => Promise<void>;
}) {
  const [item, setItem] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const change = (key: keyof Product, value: string | number | string[]) =>
    setItem((prev) => ({ ...prev, [key]: value }));
  async function addPhotos(files: File[]) {
    setBusy(true);
    setError("");
    try {
      const urls: string[] = [];
      for (const file of files)
        urls.push(await uploadImage(await optimizeImage(file)));
      change("images", [...item.images, ...urls]);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (!item.images.length) {
      setError("Agrega al menos una foto de la prenda.");
      return;
    }
    setBusy(true);
    try {
      await saveProduct(item);
      await onSave();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="admin-panel admin-form" onSubmit={submit}>
      <h2>{initial.name ? "Editar prenda" : "Nueva prenda"}</h2>
      <fieldset disabled={busy}>
        <div className="admin-form-grid">
          <Field
            label="Nombre de la prenda"
            required
            wide
            maxLength={140}
            value={item.name}
            onChange={(e) => change("name", e.target.value)}
          />
          <Field
            label="Precio en pesos"
            type="number"
            inputMode="decimal"
            required
            min=".01"
            step=".01"
            value={item.price || ""}
            onChange={(e) => change("price", Number(e.target.value))}
          />
          <Field
            label="Tipo de prenda"
            list="garment-types"
            placeholder="Ej. Camisa"
            required
            value={item.category}
            onChange={(e) => change("category", e.target.value)}
          />
          <datalist id="garment-types">
            {[
              "Camisa",
              "Playera",
              "Polo",
              "Pantalón",
              "Enterizo",
              "Vestido",
              "Falda",
              "Chamarra",
              "Suéter",
              "Blusa",
            ].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </datalist>
          <Field
            label="Talla"
            required
            value={item.size}
            onChange={(e) => change("size", e.target.value)}
          />
          <Field
            label="Color"
            required
            value={item.color}
            onChange={(e) => change("color", e.target.value)}
          />
          <Field
            label="Condición"
            required
            list="garment-conditions"
            value={item.condition}
            onChange={(e) => change("condition", e.target.value)}
          />
          <datalist id="garment-conditions">
            {[
              "Nueva con etiqueta",
              "Nueva",
              "Como nueva",
              "Buen estado",
              "Con detalles",
            ].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </datalist>
          <label className="admin-field">
            Disponibilidad
            <select
              disabled={initial.status === "reserved"}
              value={item.status}
              onChange={(e) => change("status", e.target.value)}
            >
              {Object.entries(stockLabels)
                .filter(
                  ([key]) =>
                    key !== "reserved" || initial.status === "reserved",
                )
                .map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
            </select>
          </label>
          <Field
            label="Marca"
            value={item.brand}
            onChange={(e) => change("brand", e.target.value)}
          />
          <Field
            label="Material"
            value={item.material}
            onChange={(e) => change("material", e.target.value)}
          />
          <Field
            label="Medidas en centímetros"
            wide
            placeholder="Ej. Pecho 48 cm, largo 65 cm"
            value={item.measurements}
            onChange={(e) => change("measurements", e.target.value)}
          />
          <label className="admin-field full">
            Descripción y detalles de uso
            <textarea
              required
              value={item.description}
              onChange={(e) => change("description", e.target.value)}
            />
          </label>
          <Field
            label="Fotos de la prenda"
            wide
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => {
              const files = Array.from(e.target.files || []);
              e.target.value = "";
              if (files.length) void addPhotos(files);
            }}
          />
          {item.images.length > 0 && (
            <div className="admin-thumbs full">
              {item.images.map((url, i) => (
                <div key={url + i} className="admin-thumb">
                  <img src={url} alt={"Foto " + (i + 1)} />
                  {i === 0 ? (
                    <strong className="admin-help">Portada</strong>
                  ) : (
                    <button
                      className="admin-button"
                      type="button"
                      onClick={() =>
                        change("images", [
                          url,
                          ...item.images.filter((_, index) => index !== i),
                        ])
                      }
                    >
                      Hacer portada
                    </button>
                  )}
                  <button
                    className="admin-button"
                    type="button"
                    disabled={i === 0}
                    onClick={() => {
                      const images = [...item.images];
                      [images[i - 1], images[i]] = [images[i], images[i - 1]];
                      change("images", images);
                    }}
                  >
                    Mover antes
                  </button>
                  <button
                    className="admin-button"
                    type="button"
                    onClick={() =>
                      change(
                        "images",
                        item.images.filter((_, index) => index !== i),
                      )
                    }
                  >
                    Quitar
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="admin-actions">
          <button className="admin-button primary">
            {busy ? "Procesando…" : "Guardar prenda"}
          </button>
          <button type="button" className="admin-button" onClick={onClose}>
            Volver al inventario
          </button>
        </div>
      </fieldset>
      {error && (
        <p className="admin-feedback" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}

function SettingsEditor({
  initial,
  onSave,
}: {
  initial: Settings;
  onSave: () => Promise<void>;
}) {
  const [settings, setSettings] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const set = <K extends keyof Settings>(key: K, value: Settings[K]) =>
    setSettings((prev) => ({ ...prev, [key]: value }));
  const pointChange = (id: string, changes: Partial<MeetingPoint>) =>
    set(
      "meetingPoints",
      settings.meetingPoints.map((p) =>
        p.id === id ? { ...p, ...changes } : p,
      ),
    );
  const coordinates = (
    latitude: number,
    longitude: number,
    change: (patch: { latitude?: number; longitude?: number }) => void,
  ) => (
    <>
      <Field
        label="Latitud"
        type="number"
        min="-90"
        max="90"
        step="any"
        required
        value={Number.isFinite(latitude) ? latitude : ""}
        onChange={(e) => change({ latitude: e.target.valueAsNumber })}
      />
      <Field
        label="Longitud"
        type="number"
        min="-180"
        max="180"
        step="any"
        required
        value={Number.isFinite(longitude) ? longitude : ""}
        onChange={(e) => change({ longitude: e.target.valueAsNumber })}
      />
    </>
  );
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      await saveSettings(settings);
      await onSave();
      setMessage("Configuración guardada.");
    } catch (err) {
      setMessage(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="admin-panel admin-form" onSubmit={submit}>
      <h2>Configuración de la tienda</h2>
      <fieldset disabled={busy}>
        <legend>Identidad y contacto</legend>
        <div className="admin-form-grid">
          <label className="admin-field full">
            Presentación de la tienda
            <textarea
              maxLength={300}
              value={settings.storeIntro || ""}
              placeholder="Cuéntales a tus clientes qué encontrarán en tu clóset."
              onChange={(e) => set("storeIntro", e.target.value)}
            />
          </label>
          <label className="admin-field full">
            Política de cambios y devoluciones
            <textarea
              value={settings.returnPolicy || ""}
              onChange={(e) => set("returnPolicy", e.target.value)}
            />
          </label>
          <Field
            label="Nombre de la tienda"
            required
            wide
            value={settings.storeName}
            onChange={(e) => set("storeName", e.target.value)}
          />
          <Field
            label="Teléfono con lada"
            type="tel"
            required
            minLength={10}
            value={settings.phone}
            onChange={(e) => set("phone", e.target.value)}
          />
          <Field
            label="WhatsApp con código de país"
            type="tel"
            required
            minLength={10}
            placeholder="52 y 10 dígitos"
            value={settings.whatsapp}
            onChange={(e) => set("whatsapp", e.target.value)}
          />
        </div>
      </fieldset>
      <fieldset disabled={busy}>
        <legend>Entregas</legend>
        <p className="admin-help">
          Las coordenadas de la tienda definen el centro del radio de entrega de
          5 km.
        </p>
        <div className="admin-form-grid">
          {coordinates(settings.baseLatitude, settings.baseLongitude, (patch) =>
            setSettings((prev) => ({
              ...prev,
              ...(patch.latitude !== undefined
                ? { baseLatitude: patch.latitude }
                : { baseLongitude: patch.longitude! }),
            })),
          )}
          <Field
            label="Compra mínima para entrega a domicilio (MXN)"
            wide
            type="number"
            min="0"
            step=".01"
            required
            value={settings.homeMinimum}
            onChange={(e) => set("homeMinimum", Number(e.target.value))}
          />
        </div>
        <h3>Puntos de encuentro aprobados</h3>
        {settings.meetingPoints.map((point) => (
          <div className="admin-point" key={point.id}>
            <div className="admin-form-grid">
              <Field
                label="Nombre del punto"
                required
                value={point.name}
                onChange={(e) =>
                  pointChange(point.id, { name: e.target.value })
                }
              />
              <Field
                label="Dirección e indicaciones"
                required
                value={point.address}
                onChange={(e) =>
                  pointChange(point.id, { address: e.target.value })
                }
              />
              {coordinates(point.latitude, point.longitude, (patch) =>
                pointChange(point.id, patch),
              )}
            </div>
            <button
              className="admin-button"
              type="button"
              onClick={() =>
                set(
                  "meetingPoints",
                  settings.meetingPoints.filter((p) => p.id !== point.id),
                )
              }
            >
              Quitar punto
            </button>
          </div>
        ))}
        <div className="admin-actions">
          <button
            className="admin-button"
            type="button"
            onClick={() =>
              set("meetingPoints", [
                ...settings.meetingPoints,
                {
                  id: crypto.randomUUID(),
                  name: "",
                  address: "",
                  latitude: settings.baseLatitude,
                  longitude: settings.baseLongitude,
                },
              ])
            }
          >
            Agregar punto de encuentro
          </button>
        </div>
      </fieldset>
      <fieldset disabled={busy}>
        <legend>Transferencias</legend>
        <div className="admin-form-grid">
          <Field
            label="Plazo para pagar (horas)"
            type="number"
            min="1"
            required
            value={settings.transferHours}
            onChange={(e) => set("transferHours", Number(e.target.value))}
          />
          <label className="admin-field full">
            Instrucciones de pago
            <textarea
              required
              value={settings.bankInstructions}
              placeholder="Banco, titular, CLABE y datos que deberá incluir el cliente"
              onChange={(e) => set("bankInstructions", e.target.value)}
            />
          </label>
        </div>
      </fieldset>
      <div>
        <button disabled={busy} className="admin-button primary">
          {busy ? "Guardando…" : "Guardar configuración"}
        </button>
      </div>
      {message && (
        <p className="admin-feedback" role="status">
          {message}
        </p>
      )}
    </form>
  );
}

type Tab = "orders" | "inventory" | "settings";
interface Dashboard {
  orders: Order[];
  products: Product[];
  settings: Settings;
}
export default function Admin() {
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [data, setData] = useState<Dashboard | null>(null);
  const [tab, setTab] = useState<Tab>("orders");
  const [editing, setEditing] = useState<Product | null>(null);
  const [query, setQuery] = useState("");
  const [orderFilter, setOrderFilter] = useState("all");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  const knownOrders = useRef<Set<string> | null>(null);
  const revision = useRef(0);
  async function refresh(notify = false) {
    const token = ++revision.current;
    const [orders, products, settings] = await Promise.all([
      getOrders(),
      getProducts(),
      getSettings(),
    ]);
    if (token !== revision.current) return;
    if (
      notify &&
      knownOrders.current &&
      orders.some((order) => !knownOrders.current!.has(order.id))
    )
      setFeedback("Recibiste un pedido nuevo.");
    knownOrders.current = new Set(orders.map((order) => order.id));
    setData({
      orders: [...orders].sort((a, b) =>
        b.createdAt.localeCompare(a.createdAt),
      ),
      products,
      settings,
    });
  }
  useEffect(() => {
    let active = true;
    isAdmin()
      .then((value) => {
        if (active) setAuthorized(value);
      })
      .catch((err) => {
        if (active) {
          setAuthorized(false);
          setFeedback(errorMessage(err));
        }
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (!authorized) return;
    const load = (notify = false) =>
      refresh(notify).catch((err) => setFeedback(errorMessage(err)));
    void load();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void load(true);
    }, 30000);
    return () => {
      window.clearInterval(timer);
      revision.current++;
    };
  }, [authorized]);
  async function login(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setFeedback("");
    try {
      await signIn(email, password);
      if (!(await isAdmin())) {
        await signOut();
        throw new Error("Esta cuenta no tiene acceso a la administración.");
      }
      setPassword("");
      setAuthorized(true);
    } catch (err) {
      setFeedback(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }
  async function logout() {
    setBusy(true);
    try {
      await signOut();
      revision.current++;
      knownOrders.current = null;
      setData(null);
      setEditing(null);
      setAuthorized(false);
      setFeedback("");
    } catch (err) {
      setFeedback(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }
  async function transition(order: Order, status: OrderStatus) {
    if (
      status === "cancelled" &&
      !window.confirm("¿Cancelar este pedido y liberar sus prendas?")
    )
      return;
    if (
      status === "delivered" &&
      !window.confirm(
        "¿Confirmar que ya entregaste las prendas y recibiste el pago?",
      )
    )
      return;
    setBusy(true);
    setFeedback("");
    try {
      await updateOrder(order.id, status);
      await refresh();
      window.dispatchEvent(new Event("store-updated"));
      setFeedback("Pedido actualizado.");
    } catch (err) {
      setFeedback(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }
  if (authorized === null)
    return (
      <main className="admin-shell" aria-busy="true">
        <p>Verificando acceso…</p>
      </main>
    );
  if (!authorized)
    return (
      <main className="admin-shell">
        <form className="admin-panel admin-form admin-login" onSubmit={login}>
          <h1>Administración</h1>
          {demoMode ? (
            <p className="admin-demo">
              Modo de demostración. Los cambios se guardan en este navegador.
            </p>
          ) : (
            <>
              <Field
                label="Correo electrónico"
                required
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <Field
                label="Contraseña"
                required
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </>
          )}
          <button className="admin-button primary" disabled={busy}>
            {busy
              ? "Ingresando…"
              : demoMode
                ? "Entrar a la demostración"
                : "Iniciar sesión"}
          </button>
          {feedback && (
            <p className="admin-feedback" role="alert">
              {feedback}
            </p>
          )}
        </form>
      </main>
    );
  const orders = data?.orders || [];
  const products = data?.products || [];
  const activeOrders = orders.filter(
    (o) => o.status === "awaiting_payment" || o.status === "confirmed",
  );
  const stats = [
    [
      "Prendas disponibles",
      products.filter((p) => p.status === "available").length,
    ],
    [
      "Prendas apartadas",
      products.filter((p) => p.status === "reserved").length,
    ],
    ["Pedidos pendientes", activeOrders.length],
    [
      "Ventas entregadas",
      money.format(
        orders
          .filter((o) => o.status === "delivered")
          .reduce((sum, o) => sum + o.total, 0),
      ),
    ],
  ];
  const shownOrders = orders.filter(
    (o) => orderFilter === "all" || o.status === orderFilter,
  );
  const shownProducts = products.filter((p) =>
    (p.name + " " + p.category + " " + p.size + " " + p.color)
      .toLocaleLowerCase("es-MX")
      .includes(query.toLocaleLowerCase("es-MX")),
  );
  return (
    <main className="admin-shell">
      <div className="admin-top">
        <h1>Administración</h1>
        <button className="admin-button" disabled={busy} onClick={logout}>
          Cerrar sesión
        </button>
      </div>
      {demoMode && (
        <p className="admin-demo">
          Modo de demostración · Datos guardados en este navegador
        </p>
      )}
      {feedback && (
        <p className="admin-feedback" role="status">
          {feedback}
        </p>
      )}
      {!data ? (
        <div>
          <p>Cargando inventario y pedidos…</p>
          <button
            className="admin-button"
            onClick={() =>
              refresh().catch((err) => setFeedback(errorMessage(err)))
            }
          >
            Volver a cargar
          </button>
        </div>
      ) : (
        <>
          <div className="admin-stats">
            {stats.map(([label, value]) => (
              <div className="admin-stat" key={label}>
                <small>{label}</small>
                <strong>{value}</strong>
              </div>
            ))}
          </div>
          <nav
            className="admin-tabbar"
            aria-label="Secciones de administración"
          >
            {(
              [
                ["orders", "Pedidos"],
                ["inventory", "Inventario"],
                ["settings", "Configuración"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                aria-pressed={tab === key}
                className="admin-tab"
                onClick={() => {
                  setTab(key);
                  setFeedback("");
                }}
              >
                {label}
              </button>
            ))}
          </nav>
          {tab === "settings" && (
            <SettingsEditor
              initial={data.settings}
              onSave={async () => {
                await refresh();
                window.dispatchEvent(new Event("store-updated"));
              }}
            />
          )}
          {tab === "inventory" &&
            (editing ? (
              <ProductEditor
                key={editing.id}
                initial={editing}
                onClose={() => setEditing(null)}
                onSave={async () => {
                  await refresh();
                  setEditing(null);
                  setFeedback("Prenda guardada.");
                  window.dispatchEvent(new Event("store-updated"));
                }}
              />
            ) : (
              <>
                <div className="admin-row">
                  <h2>Inventario</h2>
                  <button
                    className="admin-button primary"
                    onClick={() => setEditing(emptyProduct())}
                  >
                    Agregar prenda
                  </button>
                </div>
                <div className="admin-search">
                  <Field
                    label="Buscar en el inventario"
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </div>
                <div className="admin-list" style={{ marginTop: "1rem" }}>
                  {shownProducts.map((p) => (
                    <article className="admin-product" key={p.id}>
                      {p.images[0] && (
                        <img src={p.images[0]} alt="" loading="lazy" />
                      )}
                      <div className="admin-item-info">
                        <h3>{p.name}</h3>
                        <p>
                          {money.format(p.price)} · Talla {p.size} · {p.color}
                        </p>
                        <span className="admin-badge">
                          {stockLabels[p.status]}
                        </span>
                      </div>
                      <button
                        className="admin-button"
                        onClick={() =>
                          setEditing({ ...p, images: [...p.images] })
                        }
                        aria-label={"Editar " + p.name}
                      >
                        Editar
                      </button>
                    </article>
                  ))}
                  {!shownProducts.length && (
                    <p>
                      {query
                        ? "Ninguna prenda coincide con la búsqueda."
                        : "Tu inventario está vacío. Agrega tu primera prenda."}
                    </p>
                  )}
                </div>
              </>
            ))}
          {tab === "orders" && (
            <>
              <div className="admin-row">
                <h2>Pedidos</h2>
                <label className="admin-field">
                  Filtrar por estado
                  <select
                    value={orderFilter}
                    onChange={(e) => setOrderFilter(e.target.value)}
                  >
                    <option value="all">Todos los pedidos</option>
                    {Object.entries(orderLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="admin-list" style={{ marginTop: "1rem" }}>
                {shownOrders.map((o) => (
                  <article className="admin-order" key={o.id}>
                    <div className="admin-row">
                      <h3>Pedido {o.id.slice(0, 8).toUpperCase()}</h3>
                      <span className="admin-badge">
                        {orderLabels[o.status]}
                      </span>
                    </div>
                    <p className="admin-help">
                      {date.format(new Date(o.createdAt))}
                    </p>
                    <strong>{o.customerName}</strong>
                    <p>
                      <a href={"tel:" + o.phone.replace(/[^\d+]/g, "")}>
                        {o.phone}
                      </a>
                    </p>
                    <p>
                      {o.delivery === "home"
                        ? "Entrega a domicilio"
                        : "Punto de encuentro"}{" "}
                      · {o.address}
                    </p>
                    {Number.isFinite(o.latitude) &&
                      Number.isFinite(o.longitude) && (
                        <a
                          target="_blank"
                          rel="noreferrer"
                          href={
                            "https://www.google.com/maps/search/?api=1&query=" +
                            o.latitude +
                            "," +
                            o.longitude
                          }
                        >
                          Ver ubicación en el mapa
                        </a>
                      )}
                    <ul>
                      {o.items.map((i) => (
                        <li key={i.id}>
                          {i.name} · {money.format(i.price)}
                        </li>
                      ))}
                    </ul>
                    <p>
                      <strong>{money.format(o.total)}</strong> ·{" "}
                      {o.payment === "transfer"
                        ? "Transferencia"
                        : "Pago contra entrega"}
                    </p>
                    {o.status === "awaiting_payment" && o.expiresAt && (
                      <p className="admin-help">
                        El apartado vence el{" "}
                        {date.format(new Date(o.expiresAt))}.
                      </p>
                    )}
                    <div className="admin-actions">
                      {o.status === "awaiting_payment" && (
                        <button
                          disabled={busy}
                          className="admin-button primary"
                          onClick={() => transition(o, "confirmed")}
                        >
                          Confirmar pago recibido
                        </button>
                      )}
                      {o.status === "confirmed" && (
                        <button
                          disabled={busy}
                          className="admin-button primary"
                          onClick={() => transition(o, "delivered")}
                        >
                          Marcar como entregado
                        </button>
                      )}
                      {(o.status === "awaiting_payment" ||
                        o.status === "confirmed") && (
                        <button
                          disabled={busy}
                          className="admin-button"
                          onClick={() => transition(o, "cancelled")}
                        >
                          Cancelar pedido
                        </button>
                      )}
                    </div>
                  </article>
                ))}
                {!shownOrders.length && (
                  <div className="admin-panel">
                    <p>
                      {orders.length
                        ? "No hay pedidos con este estado."
                        : "Aún no tienes pedidos. Aquí aparecerán las próximas compras."}
                    </p>
                  </div>
                )}
              </div>
            </>
          )}
        </>
      )}
    </main>
  );
}
