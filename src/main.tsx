import { useEffect, useState, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { getProducts, getSettings, demoMode } from "./data";
import type { Product, Settings } from "./types";
import Checkout from "./Checkout";
import Admin from "./Admin";
import "./style.css";

const paths: Record<string, ReactNode> = {
  bag: (
    <>
      <path d="M4 8h16l1 13H3L4 8Z" />
      <path d="M8 9V6a4 4 0 0 1 8 0v3" />
    </>
  ),
  search: (
    <>
      <circle cx="10" cy="10" r="6.5" />
      <path d="m15 15 6 6" />
    </>
  ),
  hanger: (
    <>
      <path d="M10 6a2 2 0 1 1 3 1.7c-.8.5-1 .8-1 2V11L2.8 17a1.3 1.3 0 0 0 .7 2.4h17a1.3 1.3 0 0 0 .7-2.4L12 11" />
    </>
  ),
  pin: (
    <>
      <path d="M19 10c0 5-7 12-7 12S5 15 5 10a7 7 0 1 1 14 0Z" />
      <circle cx="12" cy="10" r="2" />
    </>
  ),
  close: <path d="m5 5 14 14M19 5 5 19" />,
  menu: <path d="M3 6h18M3 12h18M3 18h18" />,
  heart: (
    <path d="M12 20S2 13.4 2 7.9a5 5 0 0 1 10-1 5 5 0 0 1 10 1C22 13.4 12 20 12 20Z" />
  ),
  filter: (
    <>
      <path d="M3 6h18M3 12h18M3 18h18" />
      <path d="M8 3v6m8 0v6m-7 0v6" />
    </>
  ),
  plus: <path d="M12 4v16M4 12h16" />,
  check: <path d="m4 12 5 5L20 6" />,
};
function Icon({ name, size = 20 }: { name: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.65"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}
function Logo({ name }: { name: string }) {
  return (
    <a className="logo" href="#/">
      <img src="/mark.svg" alt="" />
      {name}
      <i>.</i>
    </a>
  );
}
function Star() {
  return (
    <span className="spark" aria-hidden="true">
      ✳
    </span>
  );
}
function Stamp() {
  return (
    <svg className="stamp" viewBox="0 0 110 110" aria-hidden="true">
      <defs>
        <path id="ring" d="M55 55m-39 0a39 39 0 1 1 78 0a39 39 0 1 1-78 0" />
      </defs>
      <circle
        cx="55"
        cy="55"
        r="52"
        fill="#f6e9c9"
        stroke="#a83129"
        strokeWidth="2.3"
        strokeDasharray="1.5 3"
      />
      <circle cx="55" cy="55" r="29" fill="none" stroke="#a83129" />
      <text
        fill="#973427"
        fontSize="11.5"
        letterSpacing="1.35"
        fontWeight="700"
      >
        <textPath href="#ring" textLength="245">
          SEGUNDA MANO · PRIMERA ELECCIÓN ·{" "}
        </textPath>
      </text>
      <g
        transform="translate(37 37) scale(1.5)"
        stroke="#aa332a"
        strokeWidth="1.4"
        fill="none"
        strokeLinejoin="round"
      >
        {paths.hanger}
      </g>
    </svg>
  );
}
const money = (price: number) =>
  new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: Number.isInteger(price) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(price);
const stateLabel = {
  available: "Disponible",
  reserved: "Apartada",
  sold: "Vendida",
};
function Card({ product: p }: { product: Product }) {
  return (
    <a className="card" href={"#/prenda/" + p.id}>
      <div className="card-image">
        {p.images[0] ? (
          <img src={p.images[0]} loading="lazy" alt={p.name} />
        ) : (
          <Icon name="hanger" size={60} />
        )}
        <span>
          {p.status === "available" ? p.condition : stateLabel[p.status]}
        </span>
      </div>
      <div className="card-title">
        <h3>{p.name}</h3>
        <b>{money(p.price)}</b>
      </div>
      <small>
        {p.category} · Talla {p.size}
      </small>
    </a>
  );
}
function Home({
  products,
  settings,
}: {
  products: Product[];
  settings: Settings;
}) {
  return (
    <>
      <section className="hero">
        <div className="hero-inner">
          <div className="hero-copy">
            <div className="eyebrow">
              <span className="rule" /> BOUTIQUE DE SEGUNDA MANO
            </div>
            <h1>
              Buen estilo.
              <br />
              <em>Otra vuelta.</em>
            </h1>
            <p>
              {settings.storeIntro ||
                "Prendas con historia, listas para tu clóset. Descubre piezas únicas de segunda mano y dales una nueva vida."}
            </p>
            <a className="primary" href="#/catalogo">
              <Icon name="bag" size={18} /> Explorar catálogo
            </a>
          </div>
          <div className="hero-art">
            <div className="photo-frame">
              <img
                className="hero-photo"
                src="/images/editorial.jpg"
                alt="Moda urbana con gabardina azul y botas blancas frente a una plaza"
              />
            </div>
            <Stamp />
          </div>
        </div>
      </section>
      <div className="benefits">
        {[
          "Piezas únicas",
          "Segunda mano",
          "Entrega local",
          "Compra consciente",
        ].map((t) => (
          <span key={t}>
            <Star />
            {t}
          </span>
        ))}
      </div>
      <section className="section arrivals">
        <div className="section-title">
          <div>
            <div className="eyebrow">
              <span className="rule" /> EL CATÁLOGO
            </div>
            <h2>
              Recién llegadas<span>.</span>
            </h2>
          </div>
          <a className="text-link" href="#/catalogo">
            Ver todo el catálogo
          </a>
        </div>
        <div className="grid">
          {products
            .filter((p) => p.status === "available")
            .slice(0, 4)
            .map((p) => (
              <Card product={p} key={p.id} />
            ))}
        </div>
        {!products.some((p) => p.status === "available") && (
          <p>Pronto tendremos más prendas disponibles.</p>
        )}
      </section>
      <section className="how" id="como">
        <div className="section">
          <div className="eyebrow">
            <span className="rule" /> DE NUESTRO CLÓSET AL TUYO
          </div>
          <h2>
            Cómo funciona<span>.</span>
          </h2>
          <div className="steps">
            {[
              [
                "hanger",
                "Encuentra tu prenda",
                "Revisa las fotos, las medidas y el estado de cada pieza.",
              ],
              [
                "pin",
                "Elige dónde recibirla",
                "Selecciona un punto de encuentro o revisa si tu compra califica para entrega a domicilio.",
              ],
              [
                "bag",
                "Confirma tu pedido",
                "Paga al recibir o por transferencia. Apartamos tu prenda cuando confirmas el pedido.",
              ],
            ].map(([icon, title, desc]) => (
              <article key={title}>
                <Icon name={icon} size={28} />
                <h3>{title}</h3>
                <p>{desc}</p>
              </article>
            ))}
          </div>
          <div className="guide">
            <details>
              <summary>Guía de estado y tallas</summary>
              <p>
                “Nueva” indica una pieza sin uso. “Como nueva” indica una pieza
                usada con señales mínimas de desgaste. Revisa la descripción y
                las fotos de cada prenda. Para elegir talla, compara sus medidas
                con las de una pieza que ya te quede bien.
              </p>
            </details>
            {settings.returnPolicy && (
              <details>
                <summary>Cambios y devoluciones</summary>
                <p>{settings.returnPolicy}</p>
              </details>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
function Catalogue({
  products,
  query,
}: {
  products: Product[];
  query: string;
}) {
  const params = new URLSearchParams(query);
  const update = (key: string, value: string) => {
    if (value) params.set(key, value);
    else params.delete(key);
    location.hash = "/catalogo" + (params.size ? "?" + params : "");
  };
  const [filters, setFilters] = useState(false);
  const fields = [
    ["category", "Tipo de prenda"],
    ["size", "Talla"],
    ["color", "Color"],
    ["condition", "Estado"],
  ] as const;
  const filtered = products.filter(
    (p) =>
      fields.every(([k]) => !params.get(k) || params.get(k) === p[k]) &&
      p.name
        .toLocaleLowerCase("es-MX")
        .includes((params.get("q") || "").toLocaleLowerCase("es-MX")) &&
      p.price >= Number(params.get("min") || 0) &&
      p.price <= Number(params.get("max") || Infinity) &&
      (!params.has("stock") || p.status === "available"),
  );
  return (
    <main className="section inner">
      <div className="eyebrow">
        <span className="rule" /> LA COLECCIÓN
      </div>
      <h1>
        Catálogo<span>.</span>
      </h1>
      <div className="searchbox">
        <Icon name="search" />
        <input
          autoFocus={params.has("buscar")}
          aria-label="Buscar prendas"
          placeholder="Buscar una prenda"
          value={params.get("q") || ""}
          onChange={(e) => update("q", e.target.value)}
        />
        <button onClick={() => setFilters(!filters)} aria-expanded={filters}>
          <Icon name="filter" /> Filtros
        </button>
      </div>
      <div className={"filters " + (filters ? "expanded" : "")}>
        {fields.map(([k, label]) => (
          <label key={k}>
            {label}
            <select
              value={params.get(k) || ""}
              onChange={(e) => update(k, e.target.value)}
            >
              <option value="">Todas las opciones</option>
              {Array.from(new Set(products.map((p) => p[k])))
                .sort()
                .map((v) => (
                  <option key={v}>{v}</option>
                ))}
            </select>
          </label>
        ))}
        {[
          ["min", "Precio mínimo"],
          ["max", "Precio máximo"],
        ].map(([k, t]) => (
          <label key={k}>
            {t}
            <input
              type="number"
              min="0"
              placeholder="MXN"
              value={params.get(k) || ""}
              onChange={(e) => update(k, e.target.value)}
            />
          </label>
        ))}
      </div>
      <div className="results">
        <span>
          {filtered.length} {filtered.length === 1 ? "prenda" : "prendas"}
        </span>
        <label>
          <input
            type="checkbox"
            checked={params.has("stock")}
            onChange={(e) => update("stock", e.target.checked ? "1" : "")}
          />{" "}
          Solo disponibles
        </label>
        {params.size > 0 && <a href="#/catalogo">Limpiar</a>}
      </div>
      <div className="grid">
        {filtered.map((p) => (
          <Card key={p.id} product={p} />
        ))}
      </div>
      {!filtered.length && (
        <p>Sin resultados. Prueba otro filtro o término de búsqueda.</p>
      )}
    </main>
  );
}
function Detail({
  p,
  cart,
  add,
}: {
  p: Product;
  cart: string[];
  add: () => void;
}) {
  const [i, setI] = useState(0);
  return (
    <main className="section inner">
      <a className="text-link" href="#/catalogo">
        Volver al catálogo
      </a>
      <div className="detail">
        <div>
          {p.images[i] && (
            <img
              className="detail-photo"
              src={p.images[i]}
              alt={p.name + " · Foto " + (i + 1)}
            />
          )}
          <div className="thumbs">
            {p.images.length > 1 &&
              p.images.map((img, j) => (
                <button
                  key={j}
                  aria-label={"Ver foto " + (j + 1)}
                  aria-pressed={i === j}
                  onClick={() => setI(j)}
                >
                  <img src={img} alt="" />
                </button>
              ))}
          </div>
        </div>
        <div>
          <div className="eyebrow">
            {p.category} · {stateLabel[p.status]}
          </div>
          <h1>{p.name}</h1>
          <strong className="price">{money(p.price)} MXN</strong>
          <p>{p.description}</p>
          <dl>
            {[
              ["Estado", p.condition],
              ["Talla", p.size],
              ["Color", p.color],
              ["Medidas", p.measurements],
              ["Material", p.material],
              ["Marca", p.brand],
            ]
              .filter(([, v]) => v)
              .map(([k, v]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
          </dl>
          <button
            className="primary"
            disabled={p.status !== "available"}
            onClick={add}
          >
            <Icon name="bag" />
            {p.status !== "available"
              ? stateLabel[p.status]
              : cart.includes(p.id)
                ? "Ver mi carrito"
                : "Agregar al carrito"}
          </button>
        </div>
      </div>
    </main>
  );
}
function readCart(): string[] {
  try {
    const ids = JSON.parse(localStorage.getItem("store.cart") || "[]");
    return Array.isArray(ids) ? ids.filter((i) => typeof i === "string") : [];
  } catch {
    return [];
  }
}
function App() {
  const [route, setRoute] = useState(location.hash.slice(1) || "/"),
    [products, setProducts] = useState<Product[]>([]),
    [settings, setSettings] = useState<Settings | null>(null),
    [error, setError] = useState(false),
    [cart, setCartState] = useState<string[]>(readCart),
    [drawer, setDrawer] = useState(false),
    [menu, setMenu] = useState(false);
  const [path, query = ""] = route.split("?");
  const refresh = () =>
    Promise.all([getProducts(), getSettings()])
      .then(([p, s]) => {
        setProducts(p);
        setSettings(s);
        setError(false);
      })
      .catch(() => setError(true));
  useEffect(() => {
    refresh();
    const hash = () => {
      setRoute(location.hash.slice(1) || "/");
      setDrawer(false);
      setMenu(false);
    };
    window.addEventListener("hashchange", hash);
    window.addEventListener("store-updated", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      window.removeEventListener("hashchange", hash);
      window.removeEventListener("store-updated", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, []);
  useEffect(() => {
    if (path === "/como") document.getElementById("como")?.scrollIntoView();
    else if (path === "/contacto")
      document.getElementById("contacto")?.scrollIntoView();
    else window.scrollTo(0, 0);
  }, [path, !!settings]);
  useEffect(() => {
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setDrawer(false);
        setMenu(false);
      }
    };
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, []);
  const setCart = (ids: string[]) => {
    setCartState(ids);
    localStorage.setItem("store.cart", JSON.stringify(ids));
  };
  const name = settings?.storeName || "Otra Vuelta",
    home = ["/", "/como", "/contacto"].includes(path),
    item = products.find((p) => p.id === path.split("/")[2]);
  const nav = [
    ["/", "Inicio"],
    ["/catalogo", "Catálogo"],
    ["/como", "Cómo funciona"],
    ["/contacto", "Contacto"],
  ];
  const cartProducts = products.filter((p) => cart.includes(p.id));
  return (
    <>
      <div className="announcement">
        <Star /> Ropa de segunda mano · Entrega local en México <Star />
      </div>
      <header>
        <div className="header-inner">
          <Logo name={name} />
          <nav className={menu ? "open" : ""}>
            {nav.map(([url, label]) => (
              <a
                className={path === url ? "active" : ""}
                href={"#" + url}
                onClick={() => setMenu(false)}
                key={url}
              >
                {label}
              </a>
            ))}
          </nav>
          <div className="header-actions">
            <a
              aria-label="Buscar prendas"
              className="icon-btn"
              href="#/catalogo?buscar=1"
            >
              <Icon name="search" />
            </a>
            <button className="cart-btn" onClick={() => setDrawer(true)}>
              <Icon name="bag" />
              <span>Carrito</span>
              <b>{cart.length}</b>
            </button>
            <button
              className="hamburger icon-btn"
              aria-label="Menú"
              aria-expanded={menu}
              onClick={() => setMenu(!menu)}
            >
              <Icon name="menu" />
            </button>
          </div>
        </div>
      </header>
      {error && (
        <p className="section" role="alert">
          No pudimos cargar la tienda.{" "}
          <button onClick={refresh}>Volver a intentar</button>
        </p>
      )}
      {path === "/admin" ? (
        <Admin />
      ) : !settings ? (
        <main className="section">{!error && "Cargando la tienda…"}</main>
      ) : home ? (
        <main>
          <Home products={products} settings={settings} />
        </main>
      ) : path === "/catalogo" ? (
        <Catalogue products={products} query={query} />
      ) : path === "/carrito" || path === "/entrega" ? (
        <Checkout
          key={path}
          cart={cart}
          setCart={setCart}
          products={products}
          settings={settings}
          page={path === "/carrito" ? "cart" : "checkout"}
          refresh={refresh}
        />
      ) : path.startsWith("/prenda/") && item ? (
        <Detail
          key={item.id}
          p={item}
          cart={cart}
          add={() => {
            if (!cart.includes(item.id)) setCart([...cart, item.id]);
            setDrawer(true);
          }}
        />
      ) : (
        <main className="section">
          <h1>Página no disponible</h1>
          <a href="#/catalogo">Volver al catálogo</a>
        </main>
      )}
      <footer id="contacto">
        <div className="section">
          <div>
            <Logo name={name} />
            <p>Ropa de segunda mano · México</p>
          </div>
          <div>
            <strong>Contacto</strong>
            {settings?.whatsapp && (
              <a href={"https://wa.me/" + mxNumber(settings.whatsapp)}>
                Escríbenos por WhatsApp
              </a>
            )}
            {settings?.phone && (
              <a href={"tel:+" + mxNumber(settings.phone)}>
                Llámanos al {settings.phone}
              </a>
            )}
            {!settings?.phone && !settings?.whatsapp && (
              <p>Los datos de contacto estarán disponibles pronto.</p>
            )}
          </div>
          <div>
            <a href="#/catalogo">Catálogo</a>
            <a href="#/admin">Administración</a>
            {demoMode && <small>Modo de demostración</small>}
          </div>
        </div>
      </footer>
      {drawer && (
        <dialog
          open
          className="drawer"
          aria-label="Tu carrito"
          onKeyDown={(e) => {
            if (e.key === "Tab") {
              const focusable =
                e.currentTarget.querySelectorAll<HTMLElement>("button,a");
              if (!focusable.length) return;
              if (e.shiftKey && document.activeElement === focusable[0]) {
                e.preventDefault();
                focusable[focusable.length - 1].focus();
              } else if (
                !e.shiftKey &&
                document.activeElement === focusable[focusable.length - 1]
              ) {
                e.preventDefault();
                focusable[0].focus();
              }
            }
          }}
        >
          <div className="shade" onClick={() => setDrawer(false)} />
          <section>
            <div className="drawer-title">
              <h2>Tu carrito</h2>
              <button
                autoFocus
                className="icon-btn"
                aria-label="Cerrar carrito"
                onClick={() => setDrawer(false)}
              >
                <Icon name="close" />
              </button>
            </div>
            {cartProducts.length ? (
              cartProducts.map((p) => (
                <div className="mini-item" key={p.id}>
                  <img src={p.images[0]} alt="" />
                  <div>
                    <b>{p.name}</b>
                    <small>
                      Talla {p.size} · {money(p.price)}
                    </small>
                  </div>
                  <button
                    aria-label={"Quitar " + p.name}
                    className="icon-btn"
                    onClick={() => setCart(cart.filter((id) => id !== p.id))}
                  >
                    <Icon name="close" size={16} />
                  </button>
                </div>
              ))
            ) : (
              <p>Tu carrito está vacío.</p>
            )}
            <div className="drawer-end">
              {cartProducts.length > 0 && (
                <p>
                  Subtotal{" "}
                  <b>
                    {money(cartProducts.reduce((s, p) => s + p.price, 0))} MXN
                  </b>
                </p>
              )}
              <a
                className="primary"
                onClick={() => setDrawer(false)}
                href={cartProducts.length ? "#/carrito" : "#/catalogo"}
              >
                {cartProducts.length
                  ? "Revisar mi carrito"
                  : "Explorar catálogo"}
              </a>
            </div>
          </section>
        </dialog>
      )}
    </>
  );
}
function mxNumber(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits.length === 10 ? "52" + digits : digits;
}
createRoot(document.getElementById("root")!).render(<App />);
