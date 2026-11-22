# Otra Vuelta

Responsive resale storefront and admin dashboard built with React, TypeScript, Vite, and Supabase. The interface uses Mexican Spanish and MXN. Each product represents one physical garment.

## Run locally

Use Node.js 24 and pnpm 11.25.0. Run `pnpm install --frozen-lockfile`, then `pnpm dev`. Open the local URL printed by Vite. Use `pnpm build` for type checking and a production build.

With both Supabase environment variables empty, the shop opens in demo mode. The six sample garments, example CDMX meeting points, MXN 500 home-delivery minimum, and 24-hour payment deadline are editable examples. Demo orders stay in the current browser. Open **Administración** in the footer and select **Entrar a la demostración** to try inventory, orders, and configuration.

## Connect the live store

1. Prepare your Supabase project using [the backend setup guide](supabase/README.md). The live catalogue starts empty.
2. Copy `.env.example` to `.env.local` for local development. Set the project URL and public anonymous or publishable key. Use only a public client key in variables beginning with `VITE_`.
3. In Cloudflare Pages, connect this source repository. Set the build command to `pnpm build`, the output directory to `dist`, and the environment variables `NODE_VERSION=24`, `PNPM_VERSION=11.25.0`, `VITE_SUPABASE_URL`, and `VITE_SUPABASE_ANON_KEY`. Build again after changing a Vite environment variable.
4. Open `/#/admin` and sign in with the authorized Supabase account. Save the real base coordinates, contacts, approved points, home minimum, and transfer instructions. Upload a garment and verify the order workflow before sharing the shop.

## Store content

In **Administración → Configuración**, enter the brand name, short introduction, return policy, phone, WhatsApp, and service details. Set meeting-point names and addresses customers can recognize. For bank transfers, specify the bank, account holder, destination account or CLABE, and instructions for identifying the payment.

For each piece, upload a cover photo, back view, label, and close-ups of wear. Include the tagged size and measurements in centimeters. Set the condition and describe defects individually. Edit the hero image in `public/images/editorial.jpg` and the brand mark in `public/mark.svg`. Sample photography is from Unsplash.

## Order handling

- Adding a product to the cart keeps it available. Submitting checkout reserves the complete order.
- A suggested meeting point opens the contact step. The customer can complete checkout after the seller agrees and adds an approved point. Approving a point in settings makes it visible to all customers.
- Home delivery uses the merchandise subtotal and a straight-line distance of at most 5 km from the store base. Location can come from device geolocation or coordinates entered by the customer.
- Pay-on-delivery orders begin confirmed. Transfer orders begin awaiting payment. Staff verify transfers before marking them confirmed.
- The admin page displays new orders while open. Delivered pieces become sold. Cancelling an active order or expiring an unpaid reservation releases its pieces.
