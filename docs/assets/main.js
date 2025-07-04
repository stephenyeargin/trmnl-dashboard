// TRMNL frame color cycling and complementary background
const frameColors = ['white', 'black', 'mint', 'gray', 'wood'];
const complementary = {
  white: '#222',    // dark background for white frame
  black: '#f5f5f5', // light background for black frame
  mint: '#2e3d2f',  // dark greenish for mint
  gray: '#e0e0e0',  // light gray for gray frame
  wood: '#f5e6d3'   // light tan for wood frame
};

document.addEventListener('DOMContentLoaded', function () {
  const frame = document.querySelector('trmnl-frame');
  if (!frame) return;
  let currentIndex = Math.floor(Math.random() * frameColors.length);
  let currentColor = frameColors[currentIndex];

  function setFrameAndBg(color) {
    if (typeof frame.setColor === 'function') {
      frame.setColor(color);
    } else {
      frame.setAttribute('color', color);
    }
    document.body.style.backgroundColor = complementary[color] || '#606060';
  }

  setFrameAndBg(currentColor);

  frame.addEventListener('click', function (e) {
    e.stopPropagation();
    let nextIndex = (currentIndex + 1) % frameColors.length;
    // If only one color, do nothing
    if (frameColors.length < 2) return;
    // If next color is the same as current, skip
    if (nextIndex === currentIndex) nextIndex = (nextIndex + 1) % frameColors.length;
    currentIndex = nextIndex;
    currentColor = frameColors[currentIndex];
    setFrameAndBg(currentColor);
  });
});
