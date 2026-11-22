import { useRef, useState, type FormEvent } from "react";
import { demoMode, distanceKm, submitOrder } from "./data";
import type { CheckoutInput, OrderReceipt, Product, Settings } from "./types";
import "./checkout.css";

interface Props {
  cart: string[];
  setCart: (ids: string[]) => void;
  products: Product[];
  settings: Settings;
  page: "cart" | "checkout";
  refresh: () => void;
}

const money = (value: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(
    value,
  );
const receiptKey = "store.checkout.receipt";
const attemptKey = "store.checkout.attempt";

type Confirmation = OrderReceipt & {
  destination?: string;
  itemNames?: string[];
};

function readReceipt(): Confirmation | null {
  try {
    return JSON.parse(sessionStorage.getItem(receiptKey) || "null");
  } catch {
    return null;
  }
}

function contactNumber(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits.length === 10 ? "52" + digits : digits;
}

function Option({
  name,
  value,
  checked,
  onChange,
  label,
  detail,
}: {
  name: string;
  value: string;
  checked: boolean;
  onChange: () => void;
  label: string;
  detail?: string;
}) {
  return (
    <label className="checkout-option">
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={onChange}
      />
      <span>
        <strong>{label}</strong>
        {detail && <small>{detail}</small>}
      </span>
    </label>
  );
}

export default function Checkout({
  cart,
  setCart,
  products,
  settings,
  page,
  refresh,
}: Props) {
  const [delivery, setDelivery] = useState<"meeting" | "home" | "suggest">(
    "meeting",
  );
  const [point, setPoint] = useState("");
  const [address, setAddress] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [locationMessage, setLocationMessage] = useState("");
  const [locating, setLocating] = useState(false);
  const [ready, setReady] = useState(false);
  const [payment, setPayment] = useState<CheckoutInput["payment"]>("delivery");
  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const [receipt, setReceipt] = useState<Confirmation | null>(() =>
    cart.length ? null : readReceipt(),
  );
  const selected = cart.map((id) =>
    products.find((product) => product.id === id),
  );
  const total = selected.reduce(
    (sum, product) => sum + (product?.price || 0),
    0,
  );
  const available = selected.every(
    (product) => product?.status === "available",
  );
  const qualifies = total >= settings.homeMinimum;
  const points = settings.meetingPoints.filter(
    (p) =>
      distanceKm(
        settings.baseLatitude,
        settings.baseLongitude,
        p.latitude,
        p.longitude,
      ) <= 5,
  );
  const chosenPoint = points.find((p) => p.id === point);
  const coordsValid =
    latitude.trim() &&
    longitude.trim() &&
    Number.isFinite(Number(latitude)) &&
    Number.isFinite(Number(longitude)) &&
    Math.abs(Number(latitude)) <= 90 &&
    Math.abs(Number(longitude)) <= 180;
  const radius = coordsValid
    ? distanceKm(
        settings.baseLatitude,
        settings.baseLongitude,
        Number(latitude),
        Number(longitude),
      )
    : null;
  const homeValid =
    qualifies && address.trim().length >= 5 && radius !== null && radius <= 5;
  const deliveryValid =
    delivery === "meeting"
      ? Boolean(chosenPoint)
      : delivery === "home" && homeValid;
  const isPaymentStep = ready && deliveryValid;
  const whatsapp = contactNumber(settings.whatsapp);
  const telephone = contactNumber(settings.phone);
  const contactText =
    "Hola, quiero proponer un punto de entrega para estas prendas: " +
    selected.flatMap((product) => (product ? [product.name] : [])).join(", ") +
    ".";
  const isCart = page === "cart";

  function locate() {
    if (!navigator.geolocation) {
      setLocationMessage(
        "Este navegador no comparte ubicación. Escribe las coordenadas del domicilio.",
      );
      return;
    }
    setLocating(true);
    setLocationMessage("");
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setLatitude(coords.latitude.toFixed(6));
        setLongitude(coords.longitude.toFixed(6));
        setLocating(false);
        setLocationMessage(
          "Ubicación recibida. Verifica que corresponda al domicilio de entrega.",
        );
      },
      () => {
        setLocating(false);
        setLocationMessage(
          "No pudimos obtener tu ubicación. Puedes escribir las coordenadas que aparecen al mantener presionado el domicilio en tu aplicación de mapas.",
        );
      },
      { timeout: 12000, enableHighAccuracy: true, maximumAge: 0 },
    );
  }

  function advance(event: FormEvent) {
    event.preventDefault();
    if (!deliveryValid) {
      setError(
        delivery === "meeting"
          ? "Selecciona un punto de encuentro para continuar."
          : "Ingresa un domicilio y una ubicación válida dentro de la zona de entrega.",
      );
      return;
    }
    setError("");
    setReady(true);
  }

  async function order(event: FormEvent) {
    event.preventDefault();
    if (submitting.current) return;
    if (!isPaymentStep || delivery === "suggest" || !cart.length) {
      setError("Revisa tus prendas y la opción de entrega.");
      return;
    }
    if (
      customerName.trim().length < 2 ||
      !/^\d{10,15}$/.test(phone.replace(/[^\d]/g, ""))
    ) {
      setError(
        "Ingresa tu nombre y un teléfono válido para coordinar la entrega.",
      );
      return;
    }
    const details = {
      productIds: [...cart].sort(),
      customerName: customerName.trim(),
      phone: phone.trim(),
      delivery,
      payment,
      ...(delivery === "home"
        ? {
            address: address.trim(),
            latitude: Number(latitude),
            longitude: Number(longitude),
          }
        : { meetingPointId: point }),
    };
    submitting.current = true;
    setBusy(true);
    setError("");
    try {
      const fingerprint = JSON.stringify(details);
      let previous: { fingerprint: string; id: string } | null = null;
      try {
        previous = JSON.parse(sessionStorage.getItem(attemptKey) || "null");
      } catch {
        /* New checkout attempt. */
      }
      const isRetry = previous?.fingerprint === fingerprint;
      if (!available && !isRetry) {
        setError("Hay prendas que ya no están disponibles. Revisa tu carrito.");
        return;
      }
      const requestId = previous && isRetry ? previous.id : crypto.randomUUID();
      sessionStorage.setItem(
        attemptKey,
        JSON.stringify({ fingerprint, id: requestId }),
      );
      const result = await submitOrder({ ...details, requestId });
      const confirmation: Confirmation = {
        ...result,
        destination:
          delivery === "home"
            ? address.trim()
            : [chosenPoint?.name, chosenPoint?.address]
                .filter(Boolean)
                .join(" · "),
        itemNames: selected.flatMap((product) =>
          product ? [product.name] : [],
        ),
      };
      setReceipt(confirmation);
      sessionStorage.setItem(receiptKey, JSON.stringify(confirmation));
      sessionStorage.removeItem(attemptKey);
      setCart([]);
      void refresh();
      window.scrollTo(0, 0);
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      setError(
        /^[¿¡A-ZÁÉÍÓÚÑ].*[áéíóúñ]|prenda|pedido|entrega|disponib|pago|carrito/i.test(
          message,
        )
          ? message
          : "No pudimos confirmar tu pedido. Revisa tu conexión e intenta de nuevo.",
      );
      if (/prenda|disponib/i.test(message)) void refresh();
    } finally {
      setBusy(false);
      submitting.current = false;
    }
  }

  if (receipt && !isCart && !cart.length)
    return (
      <main className="checkout-shell checkout-success">
        <h1>Pedido recibido</h1>
        <section className="checkout-card">
          <h2>
            {receipt.payment === "transfer"
              ? "Tus prendas están apartadas"
              : "Tu pedido está confirmado"}
          </h2>
          <p>
            Folio <strong className="checkout-bank">{receipt.id}</strong>
          </p>
          {receipt.itemNames?.length ? (
            <p className="checkout-note">{receipt.itemNames.join(" · ")}</p>
          ) : null}
          {receipt.destination && (
            <p className="checkout-note">
              <strong>Lugar de entrega</strong>
              <br />
              {receipt.destination}
            </p>
          )}
          <div className="checkout-pair checkout-grand">
            <span>Total en MXN</span>
            <strong>{money(receipt.total)}</strong>
          </div>
          {receipt.payment === "transfer" ? (
            <>
              <p>
                Haz la transferencia con los siguientes datos. Usa tu folio como
                referencia.
              </p>
              <p className="checkout-note checkout-bank">
                {receipt.bankInstructions}
              </p>
              {receipt.expiresAt && (
                <p className="checkout-note">
                  Completa el pago antes del{" "}
                  {new Intl.DateTimeFormat("es-MX", {
                    dateStyle: "long",
                    timeStyle: "short",
                    timeZone: "America/Mexico_City",
                  }).format(new Date(receipt.expiresAt))}{" "}
                  (hora del centro de México).
                </p>
              )}
            </>
          ) : (
            <p>
              Te contactaremos al teléfono que registraste para coordinar la
              entrega. Paga al recibir tus prendas.
            </p>
          )}
        </section>
        <a className="checkout-action checkout-full" href="#/catalogo">
          Seguir explorando
        </a>
      </main>
    );

  if (!cart.length)
    return (
      <main className="checkout-shell">
        <a className="checkout-back" href="#/catalogo">
          Volver al catálogo
        </a>
        <h1>Tu carrito</h1>
        <section className="checkout-card checkout-empty">
          <h2>Tu carrito está vacío</h2>
          <p className="checkout-muted">
            Explora las prendas disponibles y agrega las que te gusten.
          </p>
          <a className="checkout-action" href="#/catalogo">
            Explorar catálogo
          </a>
        </section>
      </main>
    );

  return (
    <main className="checkout-shell">
      <a className="checkout-back" href={isCart ? "#/catalogo" : "#/carrito"}>
        {isCart ? "Volver al catálogo" : "Volver al carrito"}
      </a>
      <h1>{isCart ? "Tu carrito" : "Entrega y pago"}</h1>
      {demoMode && (
        <p>
          Estás en la tienda de demostración. Los pedidos de prueba se guardan
          en este navegador.
        </p>
      )}
      <div className="checkout-grid">
        <div>
          {isCart ? (
            <section aria-label="Prendas en el carrito">
              {selected.map((product, index) => (
                <article className="checkout-item" key={cart[index]}>
                  {product?.images[0] ? (
                    <img src={product.images[0]} alt={product.name} />
                  ) : (
                    <span />
                  )}
                  <div>
                    <h3>{product?.name || "Prenda retirada"}</h3>
                    {product && (
                      <p className="checkout-muted">
                        Talla {product.size} · {product.color}
                      </p>
                    )}
                    {product?.status !== "available" && (
                      <p className="checkout-unavailable">
                        Ya no está disponible
                      </p>
                    )}
                    <button
                      className="checkout-remove"
                      onClick={() =>
                        setCart(cart.filter((id) => id !== cart[index]))
                      }
                    >
                      Quitar del carrito
                    </button>
                  </div>
                  <strong>{product && money(product.price)}</strong>
                </article>
              ))}
            </section>
          ) : (
            <div className="checkout-form">
              <section className="checkout-card">
                <h2>Entrega</h2>
                {isPaymentStep ? (
                  <>
                    <p>
                      {delivery === "meeting"
                        ? chosenPoint?.name
                        : "Entrega a domicilio"}
                    </p>
                    <p className="checkout-muted">
                      {delivery === "meeting" ? chosenPoint?.address : address}
                    </p>
                    <button
                      className="checkout-remove"
                      disabled={busy}
                      onClick={() => {
                        setReady(false);
                        setError("");
                      }}
                    >
                      Cambiar entrega
                    </button>
                  </>
                ) : (
                  <form onSubmit={advance}>
                    <fieldset>
                      <legend>¿Cómo quieres recibir tus prendas?</legend>
                      <div className="checkout-options">
                        <Option
                          name="delivery"
                          value="meeting"
                          label="Punto de encuentro"
                          detail="Elige uno de nuestros puntos autorizados."
                          checked={delivery === "meeting"}
                          onChange={() => {
                            setDelivery("meeting");
                            setError("");
                          }}
                        />
                        {qualifies && (
                          <Option
                            name="delivery"
                            value="home"
                            label="Entrega a domicilio"
                            detail="Disponible dentro de un radio de 5 km de nuestra base."
                            checked={delivery === "home"}
                            onChange={() => {
                              setDelivery("home");
                              setError("");
                            }}
                          />
                        )}
                        <Option
                          name="delivery"
                          value="suggest"
                          label="Quiero proponer otro punto"
                          checked={delivery === "suggest"}
                          onChange={() => {
                            setDelivery("suggest");
                            setError("");
                          }}
                        />
                      </div>
                    </fieldset>
                    {delivery === "meeting" && (
                      <label className="checkout-field">
                        Punto autorizado
                        <select
                          value={point}
                          required
                          onChange={(event) => setPoint(event.target.value)}
                        >
                          <option value="">Selecciona un punto</option>
                          {points.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} · {p.address}
                            </option>
                          ))}
                        </select>
                        {!points.length && (
                          <small>
                            Aún no hay puntos autorizados. Puedes proponer uno.
                          </small>
                        )}
                      </label>
                    )}
                    {delivery === "home" && qualifies && (
                      <>
                        <label className="checkout-field">
                          Domicilio de entrega
                          <textarea
                            required
                            minLength={5}
                            maxLength={500}
                            value={address}
                            onChange={(e) => setAddress(e.target.value)}
                            autoComplete="street-address"
                            placeholder="Calle, número, colonia y código postal"
                          />
                        </label>
                        <p className="checkout-muted">
                          Si estás en el domicilio, comparte tu ubicación.
                          También puedes copiar sus coordenadas desde tu
                          aplicación de mapas.
                        </p>
                        <button
                          type="button"
                          className="checkout-secondary checkout-full"
                          onClick={locate}
                          disabled={locating}
                        >
                          {locating
                            ? "Obteniendo ubicación…"
                            : "Usar mi ubicación actual"}
                        </button>
                        {locationMessage && (
                          <p className="checkout-note" role="status">
                            {locationMessage}
                          </p>
                        )}
                        <div className="checkout-coordinates">
                          <label className="checkout-field">
                            Latitud
                            <input
                              type="number"
                              step="any"
                              min="-90"
                              max="90"
                              required
                              value={latitude}
                              onChange={(e) => setLatitude(e.target.value)}
                            />
                          </label>
                          <label className="checkout-field">
                            Longitud
                            <input
                              type="number"
                              step="any"
                              min="-180"
                              max="180"
                              required
                              value={longitude}
                              onChange={(e) => setLongitude(e.target.value)}
                            />
                          </label>
                        </div>
                        {radius !== null && (
                          <p className="checkout-note" role="status">
                            {radius <= 5
                              ? "Tu ubicación está dentro de la zona de entrega."
                              : "Este domicilio está fuera de nuestra zona de entrega."}{" "}
                            Distancia en línea recta:{" "}
                            {radius.toLocaleString("es-MX", {
                              maximumFractionDigits: 2,
                            })}{" "}
                            km.
                          </p>
                        )}
                        {coordsValid && (
                          <a
                            className="checkout-back"
                            target="_blank"
                            rel="noreferrer"
                            href={
                              "https://www.openstreetmap.org/?mlat=" +
                              Number(latitude) +
                              "&mlon=" +
                              Number(longitude) +
                              "#map=17/" +
                              Number(latitude) +
                              "/" +
                              Number(longitude)
                            }
                          >
                            Verificar el punto en el mapa
                          </a>
                        )}
                      </>
                    )}
                    {delivery === "suggest" ? (
                      <div className="checkout-note">
                        <h3>Acuerda el punto con la tienda</h3>
                        <p>
                          Para continuar, contáctanos por WhatsApp o por
                          teléfono. Tu carrito se conserva mientras acordamos el
                          lugar. Cuando la tienda habilite el punto, vuelve y
                          selecciónalo para confirmar tu pedido.
                        </p>
                        <div className="checkout-contact">
                          {whatsapp && (
                            <a
                              className="checkout-action"
                              href={
                                "https://wa.me/" +
                                whatsapp +
                                "?text=" +
                                encodeURIComponent(contactText)
                              }
                              target="_blank"
                              rel="noreferrer"
                            >
                              Enviar WhatsApp
                            </a>
                          )}
                          {telephone && (
                            <a
                              className="checkout-secondary"
                              href={"tel:+" + telephone}
                            >
                              Llamar a la tienda
                            </a>
                          )}
                          {!whatsapp && !telephone && (
                            <p>
                              La tienda aún no ha publicado su número de
                              contacto.
                            </p>
                          )}
                        </div>
                      </div>
                    ) : (
                      <button
                        className="checkout-action checkout-full"
                        type="submit"
                        disabled={!available}
                      >
                        Continuar al pago
                      </button>
                    )}
                  </form>
                )}
              </section>
              {isPaymentStep && (
                <form className="checkout-card" onSubmit={order}>
                  <h2>Pago y contacto</h2>
                  <fieldset disabled={busy}>
                    <legend>Forma de pago</legend>
                    <div className="checkout-options">
                      <Option
                        name="payment"
                        value="delivery"
                        label="Pago contra entrega"
                        detail="Paga cuando recibas las prendas."
                        checked={payment === "delivery"}
                        onChange={() => setPayment("delivery")}
                      />
                      <Option
                        name="payment"
                        value="transfer"
                        label="Transferencia anticipada"
                        detail={
                          "Al confirmar, verás los datos bancarios. El apartado dura " +
                          settings.transferHours +
                          " horas."
                        }
                        checked={payment === "transfer"}
                        onChange={() => setPayment("transfer")}
                      />
                    </div>
                    <label className="checkout-field">
                      Nombre de quien recibe
                      <input
                        autoComplete="name"
                        required
                        minLength={2}
                        maxLength={100}
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                      />
                    </label>
                    <label className="checkout-field">
                      Teléfono de contacto
                      <input
                        type="tel"
                        autoComplete="tel"
                        required
                        maxLength={25}
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                      />
                    </label>
                    <button
                      className="checkout-action checkout-full"
                      disabled={busy}
                    >
                      {busy ? "Confirmando…" : "Confirmar pedido"}
                    </button>
                  </fieldset>
                </form>
              )}
              {error && (
                <p className="checkout-error" role="alert">
                  {error}
                </p>
              )}
            </div>
          )}
        </div>
        <aside className="checkout-card checkout-summary">
          <h2>Resumen del pedido</h2>
          {isCart ? (
            <div className="checkout-pair">
              <span>
                {cart.length === 1 ? "1 prenda" : cart.length + " prendas"}
              </span>
              <span>{money(total)}</span>
            </div>
          ) : (
            selected.map((p, i) => (
              <div className="checkout-pair" key={cart[i]}>
                <span>{p?.name || "Prenda retirada"}</span>
                <span>{p && money(p.price)}</span>
              </div>
            ))
          )}
          <div className="checkout-pair checkout-grand">
            <strong>Total en MXN</strong>
            <strong>{money(total)}</strong>
          </div>
          {!qualifies && (
            <p className="checkout-note">
              Agrega {money(settings.homeMinimum - total)} para alcanzar el
              mínimo de entrega a domicilio.
            </p>
          )}
          {!available && (
            <p className="checkout-error" role="alert">
              Hay prendas que ya no están disponibles. Quítalas del carrito para
              continuar.
            </p>
          )}
          {isCart && available && (
            <a className="checkout-action checkout-full" href="#/entrega">
              Elegir entrega
            </a>
          )}
        </aside>
      </div>
    </main>
  );
}
