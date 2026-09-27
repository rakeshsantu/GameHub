import { HowToPlayData } from '../components/HowToPlay'

export const HOW_TO_PLAY: Record<string, HowToPlayData> = {

  chess: {
    title: 'Chess', emoji: '♟',
    objective: 'Capture the opponent\'s King by placing it in checkmate — a position where it cannot escape capture.',
    players: '2 players', winCondition: 'Checkmate',
    setup: [
      'Pieces are arranged on the 8×8 board: Rooks at corners, Knights next, then Bishops, Queen on her colour, King on the remaining square.',
      'Pawns fill the second row for each side.',
      'White always moves first.',
    ],
    rules: [
      'King moves one square in any direction.',
      'Queen moves any number of squares in any direction.',
      'Rooks move horizontally or vertically any number of squares.',
      'Bishops move diagonally any number of squares.',
      'Knights move in an "L" shape — 2 squares then 1 (jump over pieces).',
      'Pawns move one square forward; two on their first move; capture diagonally.',
      'Special moves: Castling, En Passant, and Pawn Promotion.',
      'If your King is in check, you must escape it on your next move.',
      'Stalemate (no legal moves but not in check) results in a Draw.',
    ],
    tips: [
      'Control the centre with your pawns early.',
      'Develop your knights and bishops before moving your queen.',
      'Castle early to keep your king safe.',
      'Think ahead — consider your opponent\'s responses.',
    ],
  },

  carrom: {
    title: 'Carrom', emoji: '🎯',
    objective: 'Pot all your coins (black or white) and the red queen before your opponent pots theirs.',
    players: '2 players', winCondition: 'Pocket all your coins + queen',
    setup: [
      'The board has 9 black coins, 9 white coins, and 1 red queen arranged in the centre.',
      'Player 1 pots the black coins; Player 2 pots the white coins.',
      'Place your striker on the baseline before each shot.',
    ],
    rules: [
      'Flick the striker to knock coins into any of the four corner pockets.',
      'You must pocket the queen before your last coin — cover it by pocketing another coin of yours immediately after.',
      'If the striker falls in a pocket, your opponent gains one coin back.',
      'If you pocket the queen but fail to cover it, the queen is returned to the centre.',
      'The game ends when one player pockets all their coins (with the queen covered).',
      'Red queen scores 3 points; each coin scores 1 point.',
    ],
    tips: [
      'Aim for clusters — one good shot can pocket multiple coins.',
      'Pocketing the queen early is risky; wait until you have few coins left.',
      'Practice consistent striker placement on the baseline for angle accuracy.',
    ],
  },

  tictactoe: {
    title: 'Tic-Tac-Toe', emoji: '✕',
    objective: 'Place three of your marks in a row — horizontally, vertically, or diagonally — before your opponent.',
    players: '2 players', winCondition: '3 in a row',
    setup: [
      'The board is a 3×3 grid.',
      'Player 1 is X; Player 2 (or Bot) is O.',
      'X always goes first.',
    ],
    rules: [
      'Players take turns placing their mark (X or O) on an empty square.',
      'The first to place three marks in a line (row, column, or diagonal) wins.',
      'If all 9 squares are filled with no winner, the game is a draw.',
      'Against the "Hard" bot: the AI plays perfectly — a draw is the best you can achieve.',
    ],
    tips: [
      'The centre square is the most powerful — take it if available.',
      'If you can\'t win, make sure to block your opponent\'s third-in-a-row.',
      'On Easy/Medium, the bot makes mistakes — exploit them with fork setups.',
    ],
  },

  sudoku: {
    title: 'Sudoku', emoji: '🔢',
    objective: 'Fill the 9×9 grid so that every row, every column, and every 3×3 box contains the digits 1–9 exactly once.',
    players: '1 player', winCondition: 'Fill the grid correctly',
    setup: [
      'A partially filled 9×9 grid is presented.',
      'Easy: ~35 cells removed. Medium: ~45. Hard: ~55.',
      'Use the number pad below the grid to enter digits.',
    ],
    rules: [
      'Each row must contain every digit from 1 to 9, no repeats.',
      'Each column must contain every digit from 1 to 9, no repeats.',
      'Each of the nine 3×3 sub-boxes must also contain every digit from 1 to 9.',
      'Red highlighting indicates an incorrect entry.',
      'Pre-filled (bold) numbers are fixed and cannot be changed.',
      'Use the ✕ button to clear a cell.',
    ],
    tips: [
      'Start with rows, columns, or boxes that already have the most numbers.',
      'If a digit can only go in one cell within a row/column/box, place it there.',
      'Use the 💡 Hint button (3 available) when truly stuck.',
    ],
  },

  chowkabara: {
    title: 'Chowka Bara', emoji: '🎲',
    objective: 'Race all four of your pieces from start to home before your opponents.',
    players: '2–4 players', winCondition: 'All 4 pieces reach Home',
    setup: [
      'Each player has 4 pieces starting off the board.',
      'The board has 24 steps with a Home square at the end.',
      'Each player rolls 4 cowrie shells on their turn.',
    ],
    rules: [
      'Roll the cowrie shells: count of "mouth-up" shells = movement (0 mouths = 4; all 4 = 8).',
      'A roll of 1 or 4 is required to enter a piece onto the board.',
      'Move one piece the rolled number of steps forward.',
      'If you land on an opponent\'s piece, it is sent back to start.',
      'Safe squares cannot be used for captures.',
      'The first player to bring all 4 pieces to Home wins.',
    ],
    tips: [
      'Prioritise entering all pieces first before racing.',
      'Use roll-4 and roll-8 to move pieces in clusters for protection.',
      'Target isolated opponent pieces for captures to slow them down.',
    ],
  },

  kattamane: {
    title: 'Katta Mane (Ashta Chamma)', emoji: '🐚',
    objective: 'Race all four of your tokens around the 5×5 board and bring them to the centre Home before your opponents.',
    players: '2–4 players', winCondition: 'All 4 tokens reach Home (centre ★)',
    setup: [
      'The board is a 5×5 grid — every cell has X diagonal marks.',
      'Each player has 4 dome-shaped tokens in their colour (Red, Yellow, Green, Orange).',
      'Tokens start off the board (in the yard at your corner).',
      'Roll 4 cowrie shells to move — mouth-up faces count as 1 each; 0 up = 4; all 4 up = 8.',
    ],
    rules: [
      'You must roll a 1 or 4 to enter a token onto the board.',
      'Move one token forward by the rolled number of squares each turn.',
      'Rolling 1 or 8 earns you an extra roll immediately.',
      'If you land on an opponent\'s token on a non-safe square, their token is sent back to their yard.',
      'Safe squares (corners, edge midpoints, and the centre) cannot host captures.',
      'A token must reach exactly the Home (★ centre) to finish — do not overshoot.',
      'The first player to bring all 4 tokens to Home wins.',
    ],
    tips: [
      'Enter all your tokens quickly to spread risk and give yourself more options.',
      'Protect tokens by grouping them near safe squares.',
      'If you roll an 8, leap over danger zones in one move.',
      'Target isolated opponent tokens far from safe squares.',
    ],
  },

  taayam: {
    title: 'Taayam', emoji: '🎲',
    objective: 'Race all three of your pieces around the 40-step track and bring them Home before your opponent.',
    players: '2–4 players', winCondition: 'All 3 pieces reach Home',
    setup: [
      'Each player has 3 pieces — all start off the board.',
      'The track has 40 steps; every 5th step is a safe square.',
      'Players roll 4 cowrie shells on each turn.',
    ],
    rules: [
      'Count mouth-up cowries: 0 = 4 moves; 1–3 = face value; 4 = 8 moves.',
      'A roll of 1 or 4 is required to enter a piece onto the board.',
      'Pieces move forward by the rolled number of steps.',
      'Landing on an opponent\'s piece (on a non-safe square) sends it back to start.',
      'Safe squares (every 5th step) cannot host captures.',
      'First player to bring all pieces to position 40 (Home) wins.',
    ],
    tips: [
      'Enter pieces as soon as possible for maximum board coverage.',
      'Cluster pieces near safe squares to protect them from capture.',
      'A roll of 8 is rare and precious — use it to leap over danger zones.',
    ],
  },

  kaangichalla: {
    title: 'Kaangi Challa', emoji: '💫',
    objective: 'Score the most points across three rounds by tossing rings onto the pegged board.',
    players: '2 players', winCondition: 'Highest score after 3 rounds',
    setup: [
      'The board shows pegs worth different point values — 10 (centre gold), 5, 3, and 2.',
      'Each player throws 3 rings per round.',
      'Three rounds in total.',
    ],
    rules: [
      'Click anywhere on the board to throw your ring toward that position.',
      'If the ring lands on a peg, you score that peg\'s value.',
      'Rings that miss all pegs score 0 points.',
      'Players alternate turns; the bot plays automatically on Hard.',
      'After all three rounds, the player with the highest total wins.',
    ],
    tips: [
      'Aim directly at the centre peg (10 pts) — the gold ring is the prize.',
      'A consistent aim beats a lucky aim — practice centring your clicks.',
      'On Easy, the bot misses frequently — build a safe lead early.',
    ],
  },

  kaanadua: {
    title: 'Kaana Dua', emoji: '🎰',
    objective: 'Accumulate 30 points first — or have the highest score after 10 rounds.',
    players: '2–4 players', winCondition: 'First to 30 pts (or highest after 10 rounds)',
    setup: [
      'Each player starts with 0 points.',
      'A set of 4 cowrie shells (two-faced dice) is used.',
      'Players take turns rolling and scoring.',
    ],
    rules: [
      'Roll all 4 cowries each turn.',
      'Count the "Dua" (mouth-up) faces: 1 Dua = +1 pt; 2 Dua = +2 pts; 3 Dua = +3 pts.',
      'All 4 Dua = +8 pts (the "Grand Dua" bonus).',
      'All 4 Kaana (face-down) = −4 pts penalty.',
      'The first player to reach 30 points wins immediately.',
      'If 10 rounds pass with no one reaching 30, the highest score wins.',
    ],
    tips: [
      'The Grand Dua (all 4 up) is rare — any lead matters in the long game.',
      'After a −4 Kaana penalty, be patient — the swings are large.',
      'Against the bot on Hard, it reacts instantly — focus on your own pace.',
    ],
  },

  ludo: {
    title: 'Ludo', emoji: '🎮',
    objective: 'Race all four of your tokens from the starting yard to the Home triangle before your opponents.',
    players: '2–4 players', winCondition: 'All 4 tokens reach Home',
    setup: [
      'Each player has 4 tokens, all starting in their coloured yard.',
      'The board has a 52-square track, a home column per player, and a shared path.',
      'Players take turns rolling a single six-faced die.',
    ],
    rules: [
      'Roll a 6 to release a token from the yard onto the starting square.',
      'Move any active token forward by the number rolled.',
      'Roll a 6 to earn an extra turn.',
      'Landing on an opponent\'s token sends it back to their yard.',
      'Safe squares (marked) cannot host captures.',
      'Once a token enters the home column it moves towards Home — it cannot be captured.',
      'Exact roll needed to enter Home; excess moves are not allowed.',
    ],
    tips: [
      'Always move multiple tokens out of the yard so you\'re not relying on one.',
      'Keep tokens close together for protection from opponent captures.',
      'Prioritise blocking or capturing opponents who are ahead of you.',
    ],
  },

  snakeladders: {
    title: 'Snake & Ladders', emoji: '🐍',
    objective: 'Be the first player to reach square 100 by climbing ladders and avoiding snakes.',
    players: '2–4 players', winCondition: 'First to reach square 100',
    setup: [
      'The board is a 10×10 grid numbered 1 to 100.',
      'Ladders connect lower squares to higher ones (shortcuts).',
      'Snakes connect higher squares to lower ones (setbacks).',
      'Each player starts off the board (position 0).',
    ],
    rules: [
      'Roll the die on your turn and move forward by that many squares.',
      'Land at the bottom of a ladder — climb to the top immediately.',
      'Land on a snake\'s head — slide down to its tail.',
      'An exact roll is needed to reach square 100; if you overshoot, you stay put.',
      'First player to land exactly on 100 wins.',
    ],
    tips: [
      'The game is pure luck — but enjoy the dramatic swings!',
      'Ladders at squares 4, 9, 20, 28 and 40 give big leaps early.',
      'Watch out for snakes at 95, 99, 70 and 52 near the finish.',
    ],
  },
}
