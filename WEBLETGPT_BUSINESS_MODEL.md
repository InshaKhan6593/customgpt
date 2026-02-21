# The WebletGPT Business Model

WebletGPT operates as a true **double-sided marketplace**, meaning the platform generates revenue from both the **Creators** (who build the AI Weblets) and the **Users** (who chat with them). 

Because WebletGPT pays the underlying infrastructure costs (OpenAI, Anthropic, Image Generation APIs), all compute usage is standardized into an abstract currency called **"Credits."** 

Here is exactly how the platform monetizes both sides of the ecosystem.

---

## 1. How We Charge Users (The Demand Side)
Users have two separate potential charges. Think of it like owning a smartphone: you pay Verizon for your monthly "Data Plan" to access the internet, but you also pay Netflix a separate monthly fee to watch their premium movies.

### A. The Platform "Data Plan" (Credits)
Every time a user sends a message, it costs WebletGPT money in raw API tokens. Therefore, users must buy a monthly bucket of Credits to "fuel" their chats across the entire platform.
*   **Free Tier:** 100 Credits/month (Enough to try the platform).
*   **Plus Tier ($9.99/mo):** 1,000 Credits/month.
*   **Power Tier ($19.99/mo):** Unlimited Credits.

*(Note: Simple text chats cost 1 Credit. Heavy tasks like Image Generation cost 5 Credits, draining the bucket faster and encouraging upgrades).*

### B. The Creator Subscription (The App Store Tax)
If a Creator builds a highly valuable Weblet (e.g., "The Expert Legal Assistant"), they can put a paywall on it (e.g., $15/month). If a user wants to chat with that specific Weblet, they must subscribe to it.
*   **WebletGPT's Cut:** The platform automatically takes a **15% Platform Tax** off the top of every single Creator subscription, doing absolutely no extra work.

---

## 2. How We Charge Creators (The Supply Side)
Creators also burn compute when their Weblets are being used by thousands of people. To list a Weblet on the marketplace, Creators must pay for "Hosting."

### A. Creator Hosting Plans
Creators pay a monthly SaaS tier to host their bots and receive a wholesale bucket of Credits to cover their users' compute costs.
*   **Starter ($0/mo):** Host 1 Weblet, 200 Credits/mo.
*   **Pro ($29/mo):** Host 5 Weblets, 10,000 Credits/mo.
*   **Business ($99/mo):** Unlimited Weblets, 50,000 Credits/mo.

### B. The "Viral Protection" Auto-Reload (High Margin Profit)
If a Creator's Weblet goes viral, their 10,000 monthly credits will drain quickly. To prevent WebletGPT from losing money on runaway AI costs, the system uses an **Auto-Reload** feature.
*   When a Creator hits 0 Credits, their credit card is automatically charged **$10 for 2,000 extra overage credits**. 
*   Because 2,000 abstract credits cost WebletGPT only a few pennies in raw API tokens, this auto-reload feature is essentially pure profit.

---

## 3. The Business Model in Action: A 3-Step Example

Let's look at how this works in practice with **Alex (The Creator)** and **Sarah (The User)**.

### Step 1: The Creator Joins
Alex visits WebletGPT and builds "The Viral Marketer Bot" (which generates SEO strategies and Instagram images).
*   Alex pays WebletGPT **$29/month** for the Pro Hosting Plan to keep his bot online.
*   Alex decides to charge users **$10/month** to access his premium bot.
*   *Platform Revenue so far: $29/mo*

### Step 2: The User Joins
Sarah visits the platform, finds Alex's bot, and wants to use it.
*   Sarah pays the **$10/month** entrance fee via Stripe. 
*   WebletGPT instantly takes a **15% cut ($1.50)**. Alex keeps the rest.
*   Sarah starts using the bot heavily. Because it generates images, she runs out of her free 100 Platform Credits in two days.
*   To keep using the bot she just paid for, Sarah is forced to upgrade her Platform Data Plan to **Plus ($9.99/month)** for 1,000 Credits.
*   *Platform Revenue so far: $29.00 + $1.50 + $9.99 = $40.49/mo*

### Step 3: The Profit Margin (The "Double Dip")
Sarah asks the bot to generate an Instagram marketing image.

1.  **The Actual Cost:** WebletGPT pays OpenAI exactly **$0.04** to generate the image.
2.  **The Double Deduction:** Because generating an image is a "Heavy Activity," WebletGPT deducts **5 Credits from Sarah's bucket** AND **5 Credits from Alex's bucket** simultaneously.

**The Genius of the Model:** 
WebletGPT collected subscription money from *both* Alex and Sarah to cover the exact same $0.04 compute cost. You are generating highly predictable Software-as-a-Service (SaaS) recurring revenue from both sides of the marketplace, while passing the raw API costs directly to the users via abstract credits.
