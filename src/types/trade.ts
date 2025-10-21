export interface TradeEntry {
  id: string;
  user_id: string;
  created_at: string;
  exchange: string;
  symbol: string;
  direction: "Long" | "Short";
  entry_price: number;
  stop_price: number;
  take_profit: number | null;
  exposure_mode: string;
  risk_mode: string;
  margin_capital: number | null;
  position_size: number | null;
  risk_value: number | null;
  price_delta: number | null;
  price_delta_pct: number | null;
  theoretical_max_leverage: number | null;
  max_leverage: number | null;
  max_position_size: number | null;
  allowed_loss: number | null;
  loss_at_stop: number | null;
  risk_percent_of_capital: number | null;
  risk_reward_ratio: number | null;
  expected_profit: number | null;
  expected_return_pct: number | null;
  notes: string | null;
}
