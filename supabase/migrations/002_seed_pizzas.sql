-- Seed the four core pizzas with exact values from the build brief
-- Prices in cents. Run after 001_initial_schema.sql.

insert into pizzas (name, description, category, price_cents, nightly_cap, allergens, is_active, is_special, sort_order)
values
  (
    'Margherita',
    'San Marzano tomato, fior di latte, fresh basil, extra virgin olive oil',
    'Pizze Rosse',
    1800,  -- $18.00
    20,
    array['gluten', 'dairy'],
    true,
    false,
    1
  ),
  (
    'Diavola',
    'San Marzano tomato, fior di latte, spicy Calabrian salami, chilli oil',
    'Pizze Rosse',
    2000,  -- $20.00
    20,
    array['gluten', 'dairy', 'pork'],
    true,
    false,
    2
  ),
  (
    'Salsicce e Friarielli',
    'Fior di latte, house fennel sausage, sautéed broccoli rabe, garlic',
    'Pizze Bianche',
    2200,  -- $22.00
    5,
    array['gluten', 'dairy', 'pork'],
    true,
    false,
    1
  ),
  (
    'Primavera',
    'Fior di latte, roasted courgette, cherry tomato, basil, lemon zest',
    'Pizze Bianche',
    2000,  -- $20.00
    5,
    array['gluten', 'dairy'],
    true,
    false,
    2
  )
on conflict do nothing;
