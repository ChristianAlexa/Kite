// Presentation helpers — map score/label to colors and glyphs. No scoring logic.

export function labelColor(label) {
  switch (label) {
    case 'Excellent':
      return {
        text: 'text-kite-excellent',
        bg: 'bg-kite-excellent',
        soft: 'bg-green-50 text-kite-excellent',
      }
    case 'Good':
      return { text: 'text-kite-good', bg: 'bg-kite-good', soft: 'bg-lime-50 text-kite-good' }
    case 'Marginal':
      return {
        text: 'text-kite-marginal',
        bg: 'bg-kite-marginal',
        soft: 'bg-amber-50 text-kite-marginal',
      }
    default:
      return { text: 'text-kite-poor', bg: 'bg-kite-poor', soft: 'bg-red-50 text-kite-poor' }
  }
}
