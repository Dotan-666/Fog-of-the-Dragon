/* ==========================================================================
   Fog of the Dragon: creatures
   The site's residents. Every section of the Dashboard and the Campaign workspace has a creature living in its
   top right corner (it moves aside or fades when it would cover something); eyes open in the dark gaps of the
   page; now and then bats cross the screen and a dragon passes overhead. Public pages place a creature with  <span data-fog-creature="mimic"></span>.

   The drawings are original line art of generic fantasy creatures, kept here as inline SVG so they follow the
   theme colors and can move. Nothing here is interactive or carries meaning: every node is aria-hidden and ignores
   the pointer, and all motion stops for visitors who prefer reduced motion.
   Remove this script tag from a page to turn the whole feature off there. Styles: Styles/creatures.css.
   ========================================================================== */
(function () {
  'use strict';
  if (window.FogCreatures) return;

  var ART = /*ART:start*/{
    dragon: "<svg viewBox=\"0 0 280 190\" xmlns=\"http://www.w3.org/2000/svg\" focusable=\"false\"><g class=\"c-breathe\"><path class=\"c-fire\" d=\"M28,117 L130,125 L154,138 L130,135 L50,133 L26,130Z\"/><g class=\"c-jaw\" style=\"transform-origin:156px 138px\"><path class=\"c-body\" d=\"M156.0,138.0C156.0,138.0 157.3,147.2 150.0,150.0C142.7,152.8 124.3,154.5 112.0,155.0C99.7,155.5 87.7,154.7 76.0,153.0C64.3,151.3 50.7,148.8 42.0,145.0C33.3,141.2 24.0,130.0 24.0,130.0C24.0,130.0 39.0,131.8 50.0,133.0C61.0,134.2 76.7,136.7 90.0,137.0C103.3,137.3 119.0,134.8 130.0,135.0C141.0,135.2 156.0,138.0 156.0,138.0Z\"/><path class=\"c-tooth\" d=\"M46.0,134.0 L50.0,125.5 L54.0,134.4 Z\"/><path class=\"c-tooth\" d=\"M61.0,134.0 L65.0,125.5 L69.0,134.4 Z\"/><path class=\"c-tooth\" d=\"M76.0,134.0 L80.0,125.5 L84.0,134.4 Z\"/><path class=\"c-tooth\" d=\"M91.0,134.0 L95.0,125.5 L99.0,134.4 Z\"/><path class=\"c-tooth\" d=\"M106.0,134.0 L110.0,125.5 L114.0,134.4 Z\"/></g><path class=\"c-body\" d=\"M14.0,104.0C12.3,100.0 16.3,95.3 20.0,92.0C23.7,88.7 29.7,85.0 36.0,84.0C42.3,83.0 49.7,87.0 58.0,86.0C66.3,85.0 78.3,81.3 86.0,78.0C93.7,74.7 98.7,70.3 104.0,66.0C109.3,61.7 118.0,52.0 118.0,52.0C118.0,52.0 123.3,63.0 127.0,64.0C130.7,65.0 135.8,59.7 140.0,58.0C144.2,56.3 136.7,61.3 152.0,54.0C167.3,46.7 232.0,14.0 232.0,14.0C232.0,14.0 179.0,60.0 184.0,66.0C189.0,72.0 262.0,50.0 262.0,50.0C262.0,50.0 212.0,78.0 208.0,86.0C204.0,94.0 226.0,93.3 238.0,98.0C250.0,102.7 280.0,114.0 280.0,114.0C280.0,114.0 280.0,190.0 280.0,190.0C280.0,190.0 204.0,190.0 204.0,190.0C204.0,190.0 200.7,174.7 196.0,168.0C191.3,161.3 182.7,155.0 176.0,150.0C169.3,145.0 156.0,138.0 156.0,138.0C156.0,138.0 140.0,126.7 130.0,124.0C120.0,121.3 107.7,122.7 96.0,122.0C84.3,121.3 71.0,121.0 60.0,120.0C49.0,119.0 37.7,118.7 30.0,116.0C22.3,113.3 15.7,108.0 14.0,104.0Z\"/><path class=\"c-tooth\" d=\"M36.0,116.9 L39.5,126.4 L44.0,117.5 Z\"/><path class=\"c-tooth\" d=\"M49.0,117.9 L52.5,127.1 L57.0,118.5 Z\"/><path class=\"c-tooth\" d=\"M62.0,119.0 L65.5,127.9 L70.0,119.6 Z\"/><path class=\"c-tooth\" d=\"M75.0,120.0 L78.5,128.7 L83.0,120.6 Z\"/><path class=\"c-tooth\" d=\"M88.0,121.0 L91.5,129.5 L96.0,121.6 Z\"/><path class=\"c-tooth\" d=\"M101.0,122.1 L104.5,130.3 L109.0,122.7 Z\"/><path class=\"c-tooth\" d=\"M114.0,123.1 L117.5,131.0 L122.0,123.7 Z\"/><path class=\"c-body\" d=\"M212.0,86.0 L226.0,68.0 L232.0,94.0 Z\"/><path class=\"c-body\" d=\"M246.0,100.0 L260.0,84.0 L264.0,108.0 Z\"/><path class=\"c-line\" d=\"M206,122q9,-8 18,0 M230,130q9,-8 18,0 M214,142q9,-8 18,0 M240,152q9,-8 18,0 M222,164q9,-8 18,0 M250,172q9,-8 18,0 M168,96q8,-6 16,0 M186,108q8,-6 16,0\"/><path class=\"c-line\" d=\"M100,74 C112,70 128,72 142,80\"/><g transform=\"rotate(-8 122 88)\"><g class=\"c-blink\" style=\"animation-delay:0.0s\"><path class=\"c-glow\" d=\"M107.0,88.0 Q122.0,77.0 137.0,88.0 Q122.0,99.0 107.0,88.0Z\"/><ellipse class=\"c-pupil\" cx=\"122\" cy=\"88\" rx=\"2.2\" ry=\"5.2\"/></g></g><ellipse class=\"c-dark\" cx=\"31\" cy=\"97\" rx=\"4.5\" ry=\"2.4\" transform=\"rotate(-24 31 97)\"/><circle class=\"c-smoke\" cx=\"26\" cy=\"92\" r=\"5\" style=\"animation-delay:0s\"/><circle class=\"c-smoke\" cx=\"26\" cy=\"92\" r=\"7\" style=\"animation-delay:1.3s\"/><circle class=\"c-smoke\" cx=\"26\" cy=\"92\" r=\"6\" style=\"animation-delay:2.6s\"/></g></svg>",
    owlbear: "<svg viewBox=\"0 0 220 206\" xmlns=\"http://www.w3.org/2000/svg\" focusable=\"false\"><g class=\"c-breathe\"><path class=\"c-body\" d=\"M50.0,18.0C50.0,18.0 64.0,39.3 74.0,42.0C84.0,44.7 98.0,34.0 110.0,34.0C122.0,34.0 136.0,44.7 146.0,42.0C156.0,39.3 170.0,18.0 170.0,18.0C170.0,18.0 175.0,46.7 178.0,60.0C181.0,73.3 187.7,86.3 188.0,98.0C188.3,109.7 177.0,119.3 180.0,130.0C183.0,140.7 200.0,149.3 206.0,162.0C212.0,174.7 216.0,206.0 216.0,206.0C216.0,206.0 4.0,206.0 4.0,206.0C4.0,206.0 8.0,174.7 14.0,162.0C20.0,149.3 37.0,140.7 40.0,130.0C43.0,119.3 31.7,109.7 32.0,98.0C32.3,86.3 39.0,73.3 42.0,60.0C45.0,46.7 50.0,18.0 50.0,18.0Z\"/><path class=\"c-line\" d=\"M58,160l9,11l9,-11 M92,170l9,11l9,-11 M126,170l9,11l9,-11 M158,160l-9,11l-9,-11 M74,186l9,11l9,-11 M128,186l9,11l9,-11\"/><path class=\"c-brow\" d=\"M52,62 L98,84 M168,62 L122,84\"/><circle class=\"c-line\" cx=\"80\" cy=\"96\" r=\"23\"/><g class=\"c-blink\" style=\"animation-delay:0s\"><circle class=\"c-glow\" cx=\"80\" cy=\"96\" r=\"15\"/><circle class=\"c-pupil\" cx=\"80\" cy=\"96\" r=\"7\"/></g><circle class=\"c-line\" cx=\"140\" cy=\"96\" r=\"23\"/><g class=\"c-blink\" style=\"animation-delay:0.08s\"><circle class=\"c-glow\" cx=\"140\" cy=\"96\" r=\"15\"/><circle class=\"c-pupil\" cx=\"140\" cy=\"96\" r=\"7\"/></g><path class=\"c-beak\" d=\"M110,100 L124,118 L110,142 L96,118Z\"/><path class=\"c-line\" d=\"M96,118 L124,118\"/></g></svg>",
    skull: "<svg viewBox=\"0 0 170 204\" xmlns=\"http://www.w3.org/2000/svg\" focusable=\"false\"><g class=\"c-bob\"><g class=\"c-chatter\"><path class=\"c-body\" d=\"M40.0,152.0C40.0,152.0 44.5,160.0 52.0,162.0C59.5,164.0 74.0,164.0 85.0,164.0C96.0,164.0 110.5,164.0 118.0,162.0C125.5,160.0 130.0,152.0 130.0,152.0C130.0,152.0 131.3,172.7 128.0,180.0C124.7,187.3 121.3,193.3 110.0,196.0C98.7,198.7 71.3,198.7 60.0,196.0C48.7,193.3 45.3,187.3 42.0,180.0C38.7,172.7 40.0,152.0 40.0,152.0Z\"/><path class=\"c-line\" d=\"M64,163 V175 M74.5,163 V175 M85,163 V175 M95.5,163 V175 M106,163 V175\"/></g><path class=\"c-body\" d=\"M85.0,8.0C99.3,8.0 116.5,12.0 128.0,20.0C139.5,28.0 150.0,43.7 154.0,56.0C158.0,68.3 154.3,84.7 152.0,94.0C149.7,103.3 142.7,105.0 140.0,112.0C137.3,119.0 136.0,136.0 136.0,136.0C136.0,136.0 121.7,138.5 118.0,142.0C114.3,145.5 114.0,157.0 114.0,157.0C114.0,157.0 56.0,157.0 56.0,157.0C56.0,157.0 55.7,145.5 52.0,142.0C48.3,138.5 34.0,136.0 34.0,136.0C34.0,136.0 32.7,119.0 30.0,112.0C27.3,105.0 20.3,103.3 18.0,94.0C15.7,84.7 12.0,68.3 16.0,56.0C20.0,43.7 30.5,28.0 42.0,20.0C53.5,12.0 70.7,8.0 85.0,8.0Z\"/><ellipse class=\"c-dark\" cx=\"58\" cy=\"90\" rx=\"18\" ry=\"20\"/><path class=\"c-glow c-flick\" style=\"animation-delay:0s\" d=\"M49,104 C46,96 55,92 58,80 C66,90 70,94 67,104 Z\"/><ellipse class=\"c-dark\" cx=\"112\" cy=\"90\" rx=\"18\" ry=\"20\"/><path class=\"c-glow c-flick\" style=\"animation-delay:0.4s\" d=\"M103,104 C100,96 109,92 112,80 C120,90 124,94 121,104 Z\"/><path class=\"c-dark\" d=\"M85,106 L96,130 L85,125 L74,130Z\"/><path class=\"c-line\" d=\"M64,143 V157 M74.5,143 V157 M85,143 V157 M95.5,143 V157 M106,143 V157\"/><path class=\"c-line\" d=\"M98,12 l-7,15 l9,8 l-6,12\"/></g></svg>",
    mimic: "<svg viewBox=\"0 0 230 196\" xmlns=\"http://www.w3.org/2000/svg\" focusable=\"false\"><path class=\"c-dark\" d=\"M24,60 H206 V110 H24Z\"/><path class=\"c-body\" d=\"M20,104 H210 L214,176 Q214,186 204,186 H26 Q16,186 16,176 Z\"/><path class=\"c-tooth\" d=\"M40.0,106.0 L47.0,91.0 L54.0,106.0 Z\"/><path class=\"c-tooth\" d=\"M61.0,106.0 L68.0,91.0 L75.0,106.0 Z\"/><path class=\"c-tooth\" d=\"M82.0,106.0 L89.0,91.0 L96.0,106.0 Z\"/><path class=\"c-tooth\" d=\"M103.0,106.0 L110.0,91.0 L117.0,106.0 Z\"/><path class=\"c-tooth\" d=\"M124.0,106.0 L131.0,91.0 L138.0,106.0 Z\"/><path class=\"c-tooth\" d=\"M145.0,106.0 L152.0,91.0 L159.0,106.0 Z\"/><path class=\"c-tooth\" d=\"M166.0,106.0 L173.0,91.0 L180.0,106.0 Z\"/><path class=\"c-line\" d=\"M56,106 V186 M174,106 V186 M16,146 H214\"/><rect class=\"c-line\" x=\"103\" y=\"112\" width=\"24\" height=\"26\" rx=\"5\"/><path class=\"c-tongue\" d=\"M96,104 C92,134 116,160 132,148 C144,138 132,122 138,104 Z\"/><g class=\"c-lid\" style=\"transform-origin:20px 102px\"><path class=\"c-body\" d=\"M22,102 L16,72 Q16,38 62,34 H168 Q214,38 214,72 L208,102 Z\"/><path class=\"c-tooth\" d=\"M30.0,101.0 L37.0,117.0 L44.0,101.0 Z\"/><path class=\"c-tooth\" d=\"M51.0,101.0 L58.0,117.0 L65.0,101.0 Z\"/><path class=\"c-tooth\" d=\"M72.0,101.0 L79.0,117.0 L86.0,101.0 Z\"/><path class=\"c-tooth\" d=\"M93.0,101.0 L100.0,117.0 L107.0,101.0 Z\"/><path class=\"c-tooth\" d=\"M114.0,101.0 L121.0,117.0 L128.0,101.0 Z\"/><path class=\"c-tooth\" d=\"M135.0,101.0 L142.0,117.0 L149.0,101.0 Z\"/><path class=\"c-tooth\" d=\"M156.0,101.0 L163.0,117.0 L170.0,101.0 Z\"/><path class=\"c-tooth\" d=\"M177.0,101.0 L184.0,117.0 L191.0,101.0 Z\"/><path class=\"c-line\" d=\"M56,36 V100 M174,36 V100\"/><g transform=\"rotate(8 84 66)\"><g class=\"c-blink\" style=\"animation-delay:0s\"><path class=\"c-glow\" d=\"M70.0,66.0 Q84.0,55.0 98.0,66.0 Q84.0,77.0 70.0,66.0Z\"/><ellipse class=\"c-pupil\" cx=\"84\" cy=\"66\" rx=\"2.1\" ry=\"5.2\"/></g></g><g transform=\"rotate(-8 146 66)\"><g class=\"c-blink\" style=\"animation-delay:0.06s\"><path class=\"c-glow\" d=\"M132.0,66.0 Q146.0,55.0 160.0,66.0 Q146.0,77.0 132.0,66.0Z\"/><ellipse class=\"c-pupil\" cx=\"146\" cy=\"66\" rx=\"2.1\" ry=\"5.2\"/></g></g></g></svg>",
    wraith: "<svg viewBox=\"0 0 190 244\" xmlns=\"http://www.w3.org/2000/svg\" focusable=\"false\"><defs><linearGradient id=\"fcWr\" x1=\"0\" y1=\"0\" x2=\"0\" y2=\"1\"><stop offset=\"0.35\" stop-color=\"#fff\"/><stop offset=\"1\" stop-color=\"#fff\" stop-opacity=\"0.05\"/></linearGradient><mask id=\"fcWrM\"><rect width=\"190\" height=\"244\" fill=\"url(#fcWr)\"/></mask></defs><g class=\"c-float\"><g mask=\"url(#fcWrM)\"><path class=\"c-body c-hem\" d=\"M95.0,8.0C106.7,8.0 121.5,17.7 130.0,28.0C138.5,38.3 144.0,57.3 146.0,70.0C148.0,82.7 138.0,90.7 142.0,104.0C146.0,117.3 163.7,134.0 170.0,150.0C176.3,166.0 180.3,186.0 180.0,200.0C179.7,214.0 168.0,234.0 168.0,234.0C168.0,234.0 156.7,205.3 152.0,206.0C147.3,206.7 140.0,238.0 140.0,238.0C140.0,238.0 129.3,207.7 124.0,208.0C118.7,208.3 108.0,240.0 108.0,240.0C108.0,240.0 99.0,210.0 94.0,210.0C89.0,210.0 78.0,240.0 78.0,240.0C78.0,240.0 69.0,208.7 64.0,208.0C59.0,207.3 48.0,236.0 48.0,236.0C48.0,236.0 40.3,206.7 36.0,206.0C31.7,205.3 22.0,232.0 22.0,232.0C22.0,232.0 12.0,209.7 12.0,196.0C12.0,182.3 16.0,165.3 22.0,150.0C28.0,134.7 44.3,117.3 48.0,104.0C51.7,90.7 42.0,82.7 44.0,70.0C46.0,57.3 51.5,38.3 60.0,28.0C68.5,17.7 83.3,8.0 95.0,8.0Z\"/></g><path class=\"c-dark\" d=\"M95.0,34.0C103.3,34.0 115.2,43.7 120.0,52.0C124.8,60.3 128.2,75.0 124.0,84.0C119.8,93.0 104.7,106.0 95.0,106.0C85.3,106.0 70.2,93.0 66.0,84.0C61.8,75.0 65.2,60.3 70.0,52.0C74.8,43.7 86.7,34.0 95.0,34.0Z\"/><g transform=\"rotate(14 82 72)\"><g class=\"c-blink\" style=\"animation-delay:0s\"><path class=\"c-glow\" d=\"M74.0,72.0 Q82.0,66.2 90.0,72.0 Q82.0,77.8 74.0,72.0Z\"/><ellipse class=\"c-pupil\" cx=\"82\" cy=\"72\" rx=\"2.0\" ry=\"2.0\"/></g></g><g transform=\"rotate(-14 108 72)\"><g class=\"c-blink\" style=\"animation-delay:0.05s\"><path class=\"c-glow\" d=\"M100.0,72.0 Q108.0,66.2 116.0,72.0 Q108.0,77.8 100.0,72.0Z\"/><ellipse class=\"c-pupil\" cx=\"108\" cy=\"72\" rx=\"2.0\" ry=\"2.0\"/></g></g><path class=\"c-line\" d=\"M60,120 C52,150 44,176 40,200 M130,120 C138,150 146,176 150,200 M95,112 V196\"/></g></svg>",
    spider: "<svg viewBox=\"0 0 240 230\" xmlns=\"http://www.w3.org/2000/svg\" focusable=\"false\"><path class=\"c-web\" d=\"M240,0 L90.8,15.7\"/><path class=\"c-web\" d=\"M240,0 L106.3,68.1\"/><path class=\"c-web\" d=\"M240,0 L139.6,111.5\"/><path class=\"c-web\" d=\"M240,0 L186.2,140.0\"/><path class=\"c-web\" d=\"M240,0 L229.5,149.6\"/><path class=\"c-web\" d=\"M200.2,4.2 Q206.1,10.1 204.4,18.2 Q211.9,21.5 213.2,29.7 Q221.5,30.2 225.7,37.3 Q232.3,34.8 237.2,39.9\"/><path class=\"c-web\" d=\"M165.4,7.8 Q176.4,18.9 173.2,34.0 Q187.3,40.4 189.8,55.7 Q205.3,56.6 213.1,70.0 Q225.6,65.2 234.8,74.8\"/><path class=\"c-web\" d=\"M130.6,11.5 Q146.7,27.6 142.0,49.9 Q162.8,59.3 166.4,81.7 Q189.1,83.0 200.6,102.7 Q218.8,95.6 232.3,109.7\"/><path class=\"c-web\" d=\"M98.8,14.8 Q119.5,35.7 113.5,64.5 Q140.3,76.5 145.0,105.5 Q174.3,107.1 189.1,132.6 Q212.6,123.4 230.1,141.7\"/><g class=\"c-drop\"><g transform=\"translate(96 150)\"><path class=\"c-web\" d=\"M0,-20 V-400\"/><g class=\"c-twitch\"><path class=\"c-leg\" d=\"M6,-14 L24,-32 L38,-18\"/><path class=\"c-leg\" d=\"M-6,-14 L-24,-32 L-38,-18\"/><path class=\"c-leg\" d=\"M8,-10 L31,-17 L44,3\"/><path class=\"c-leg\" d=\"M-8,-10 L-31,-17 L-44,3\"/><path class=\"c-leg\" d=\"M8,-6 L31,3 L42,24\"/><path class=\"c-leg\" d=\"M-8,-6 L-31,3 L-42,24\"/><path class=\"c-leg\" d=\"M6,-2 L25,15 L31,38\"/><path class=\"c-leg\" d=\"M-6,-2 L-25,15 L-31,38\"/><ellipse class=\"c-body\" cx=\"0\" cy=\"12\" rx=\"15\" ry=\"19\"/><circle class=\"c-body\" cx=\"0\" cy=\"-11\" r=\"9\"/><path class=\"c-glow\" d=\"M0,4 L5,12 L0,20 L-5,12Z\"/><circle class=\"c-glow\" cx=\"-3.5\" cy=\"-14\" r=\"1.7\"/><circle class=\"c-glow\" cx=\"3.5\" cy=\"-14\" r=\"1.7\"/></g></g></g></svg>",
    kraken: "<svg viewBox=\"0 0 280 230\" xmlns=\"http://www.w3.org/2000/svg\" focusable=\"false\"><g class=\"c-sway c-sway-a\" style=\"transform-origin:292px 206px\"><path class=\"c-body\" d=\"M299.6,185.0 L295.5,183.7 L291.4,182.3 L287.3,180.8 L283.2,179.3 L279.1,177.7 L275.1,176.0 L271.0,174.3 L267.1,172.5 L263.1,170.6 L259.2,168.7 L255.3,166.6 L251.4,164.6 L247.5,162.4 L243.7,160.2 L240.0,158.0 L236.2,155.6 L232.6,153.2 L228.9,150.8 L225.3,148.2 L221.8,145.6 L218.3,143.0 L214.8,140.3 L211.5,137.5 L208.1,134.6 L204.9,131.7 L201.7,128.7 L198.6,125.7 L195.6,122.6 L192.7,119.4 L189.9,116.1 L187.2,112.8 L184.6,109.4 L182.2,106.0 L179.8,102.5 L177.7,98.9 L175.7,95.2 L173.8,91.5 L172.2,87.7 L170.7,83.9 L169.5,80.1 L168.5,76.2 L167.8,72.3 L167.3,68.3 L167.2,64.4 L167.3,60.6 L167.8,56.8 L168.6,53.1 L169.7,49.5 L171.2,46.1 L173.1,42.9 L175.3,40.0 L177.8,37.5 L180.6,35.3 L183.7,33.6 L187.0,32.4 L190.4,31.8 L193.9,31.8 L197.2,32.5 L200.4,33.8 L203.1,35.8 L205.3,38.4 L206.9,41.4 L207.5,44.8 L207.3,48.2 L206.0,51.5 L203.8,54.2 L200.7,56.1 L197.1,56.9 L193.3,56.3 L189.8,54.4 L188.3,56.5 L192.4,60.2 L197.8,61.9 L203.5,61.4 L208.8,58.9 L213.0,54.7 L215.7,49.4 L216.7,43.5 L216.1,37.5 L213.9,31.9 L210.4,27.0 L205.8,23.0 L200.5,20.1 L194.8,18.3 L188.8,17.7 L182.9,18.1 L177.1,19.6 L171.7,21.9 L166.7,24.9 L162.1,28.6 L158.1,32.8 L154.7,37.5 L151.8,42.4 L149.5,47.6 L147.7,53.0 L146.4,58.4 L145.6,63.9 L145.2,69.4 L145.2,74.9 L145.6,80.4 L146.3,85.8 L147.3,91.1 L148.6,96.3 L150.2,101.4 L152.0,106.4 L154.0,111.2 L156.2,116.0 L158.5,120.7 L161.1,125.2 L163.7,129.7 L166.5,134.0 L169.4,138.3 L172.4,142.4 L175.6,146.5 L178.8,150.4 L182.1,154.3 L185.5,158.1 L188.9,161.8 L192.5,165.4 L196.1,169.0 L199.7,172.4 L203.5,175.8 L207.3,179.2 L211.1,182.4 L215.0,185.6 L219.0,188.7 L223.0,191.8 L227.1,194.7 L231.2,197.6 L235.4,200.5 L239.6,203.2 L243.9,205.9 L248.2,208.6 L252.6,211.1 L257.0,213.6 L261.5,216.0 L266.0,218.3 L270.5,220.6 L275.1,222.8 L279.7,224.9 L284.4,227.0Z\"/><circle class=\"c-sucker\" cx=\"286.6\" cy=\"194.1\" r=\"5.7\"/><circle class=\"c-sucker\" cx=\"265.7\" cy=\"185.0\" r=\"5.4\"/><circle class=\"c-sucker\" cx=\"245.5\" cy=\"174.2\" r=\"5.0\"/><circle class=\"c-sucker\" cx=\"226.3\" cy=\"161.7\" r=\"4.7\"/><circle class=\"c-sucker\" cx=\"208.4\" cy=\"147.6\" r=\"4.4\"/><circle class=\"c-sucker\" cx=\"191.9\" cy=\"131.7\" r=\"4.0\"/><circle class=\"c-sucker\" cx=\"177.8\" cy=\"114.0\" r=\"3.7\"/><circle class=\"c-sucker\" cx=\"167.0\" cy=\"94.4\" r=\"3.3\"/><circle class=\"c-sucker\" cx=\"161.2\" cy=\"73.0\" r=\"3.0\"/><circle class=\"c-sucker\" cx=\"163.0\" cy=\"51.5\" r=\"2.6\"/><circle class=\"c-sucker\" cx=\"174.6\" cy=\"33.8\" r=\"2.2\"/><circle class=\"c-sucker\" cx=\"194.1\" cy=\"27.9\" r=\"1.8\"/></g><g class=\"c-sway c-sway-b\" style=\"transform-origin:292px 120px\"><path class=\"c-body\" d=\"M289.6,102.9 L285.8,103.6 L282.1,104.5 L278.4,105.3 L274.7,106.2 L271.0,107.2 L267.3,108.3 L263.7,109.3 L260.1,110.5 L256.4,111.7 L252.9,112.9 L249.3,114.2 L245.7,115.5 L242.2,116.9 L238.7,118.4 L235.2,119.9 L231.7,121.4 L228.3,123.0 L224.9,124.7 L221.5,126.4 L218.1,128.2 L214.8,130.0 L211.5,131.9 L208.2,133.8 L205.0,135.8 L201.8,137.9 L198.6,140.1 L195.5,142.3 L192.4,144.6 L189.3,146.9 L186.4,149.4 L183.4,151.9 L180.5,154.6 L177.7,157.3 L175.0,160.1 L172.4,163.0 L169.8,166.1 L167.4,169.2 L165.1,172.5 L162.9,175.9 L160.9,179.4 L159.0,183.0 L157.4,186.7 L155.9,190.6 L154.8,194.6 L153.8,198.6 L153.2,202.8 L153.0,207.0 L153.0,211.3 L153.5,215.5 L154.4,219.8 L155.8,223.9 L157.6,227.8 L160.0,231.6 L162.8,235.0 L166.0,238.0 L169.7,240.5 L173.8,242.4 L178.1,243.6 L182.6,244.0 L187.2,243.5 L191.5,242.0 L195.4,239.7 L198.6,236.5 L201.0,232.7 L202.2,228.4 L202.2,223.9 L200.9,219.7 L198.4,216.1 L194.8,213.6 L190.7,212.7 L189.9,215.2 L192.6,216.5 L194.6,218.5 L195.9,221.0 L196.4,223.6 L196.1,226.3 L195.1,228.8 L193.5,230.9 L191.4,232.5 L189.0,233.6 L186.5,234.1 L183.8,234.2 L181.3,233.7 L178.8,232.7 L176.5,231.3 L174.5,229.6 L172.7,227.5 L171.2,225.3 L170.0,222.8 L169.2,220.1 L168.6,217.4 L168.3,214.5 L168.3,211.7 L168.6,208.8 L169.1,205.9 L169.9,203.1 L170.9,200.3 L172.1,197.5 L173.4,194.8 L175.0,192.2 L176.7,189.6 L178.6,187.1 L180.5,184.7 L182.7,182.3 L184.9,180.1 L187.2,177.9 L189.6,175.7 L192.1,173.7 L194.7,171.7 L197.3,169.8 L200.0,167.9 L202.8,166.2 L205.6,164.4 L208.5,162.8 L211.4,161.2 L214.3,159.6 L217.3,158.1 L220.3,156.7 L223.3,155.3 L226.4,154.0 L229.5,152.7 L232.6,151.5 L235.8,150.3 L238.9,149.2 L242.1,148.1 L245.3,147.0 L248.5,146.0 L251.7,145.1 L255.0,144.2 L258.2,143.4 L261.5,142.6 L264.7,141.8 L268.0,141.1 L271.3,140.4 L274.6,139.8 L277.9,139.3 L281.2,138.7 L284.5,138.3 L287.8,137.8 L291.1,137.5 L294.4,137.1Z\"/><circle class=\"c-sucker\" cx=\"286.1\" cy=\"128.2\" r=\"4.4\"/><circle class=\"c-sucker\" cx=\"269.1\" cy=\"131.4\" r=\"4.2\"/><circle class=\"c-sucker\" cx=\"252.3\" cy=\"135.9\" r=\"3.9\"/><circle class=\"c-sucker\" cx=\"235.8\" cy=\"141.6\" r=\"3.7\"/><circle class=\"c-sucker\" cx=\"219.9\" cy=\"148.5\" r=\"3.4\"/><circle class=\"c-sucker\" cx=\"204.7\" cy=\"156.8\" r=\"3.2\"/><circle class=\"c-sucker\" cx=\"190.6\" cy=\"166.7\" r=\"2.9\"/><circle class=\"c-sucker\" cx=\"178.2\" cy=\"178.5\" r=\"2.6\"/><circle class=\"c-sucker\" cx=\"168.8\" cy=\"192.5\" r=\"2.3\"/><circle class=\"c-sucker\" cx=\"164.1\" cy=\"208.3\" r=\"2.0\"/><circle class=\"c-sucker\" cx=\"166.4\" cy=\"224.2\" r=\"1.7\"/><circle class=\"c-sucker\" cx=\"177.3\" cy=\"235.5\" r=\"1.4\"/></g><g class=\"c-sway c-sway-c\" style=\"transform-origin:292px 34px\"><path class=\"c-body\" d=\"M287.5,21.5 L285.1,22.4 L282.8,23.4 L280.5,24.2 L278.1,25.1 L275.7,25.9 L273.3,26.6 L270.9,27.3 L268.5,28.0 L266.0,28.7 L263.6,29.3 L261.1,29.8 L258.7,30.3 L256.2,30.8 L253.7,31.3 L251.2,31.7 L248.7,32.0 L246.2,32.3 L243.7,32.6 L241.2,32.8 L238.6,33.0 L236.1,33.2 L233.6,33.3 L231.1,33.3 L228.6,33.3 L226.0,33.2 L223.5,33.1 L221.0,33.0 L218.6,32.7 L216.1,32.4 L213.6,32.1 L211.2,31.7 L208.8,31.2 L206.4,30.7 L204.0,30.0 L201.7,29.3 L199.4,28.6 L197.1,27.7 L194.9,26.8 L192.8,25.7 L190.7,24.6 L188.7,23.4 L186.8,22.1 L185.0,20.6 L183.3,19.1 L181.7,17.5 L180.2,15.8 L178.9,14.0 L177.8,12.1 L176.8,10.2 L176.0,8.2 L175.4,6.1 L175.1,4.0 L175.0,1.9 L175.2,-0.2 L175.6,-2.2 L176.3,-4.1 L177.3,-5.9 L178.5,-7.5 L180.0,-8.8 L181.7,-9.9 L183.5,-10.6 L185.5,-10.9 L187.5,-10.8 L189.4,-10.3 L191.1,-9.3 L192.6,-7.8 L193.6,-6.1 L194.1,-4.0 L193.9,-1.9 L193.2,0.1 L195.5,1.3 L197.3,-1.4 L198.0,-4.7 L197.7,-8.0 L196.3,-11.1 L194.2,-13.8 L191.5,-15.9 L188.3,-17.2 L184.9,-17.7 L181.4,-17.5 L178.1,-16.6 L175.0,-15.1 L172.2,-13.1 L169.8,-10.7 L167.9,-7.9 L166.4,-4.8 L165.3,-1.6 L164.7,1.6 L164.4,5.0 L164.6,8.3 L165.1,11.5 L165.9,14.7 L167.0,17.8 L168.4,20.7 L170.0,23.5 L171.8,26.1 L173.7,28.6 L175.8,31.0 L178.1,33.2 L180.4,35.2 L182.8,37.1 L185.4,38.9 L187.9,40.5 L190.6,42.0 L193.3,43.4 L196.0,44.7 L198.8,45.9 L201.6,47.0 L204.4,48.0 L207.2,48.9 L210.1,49.7 L212.9,50.4 L215.8,51.1 L218.7,51.7 L221.6,52.2 L224.5,52.6 L227.4,53.0 L230.3,53.3 L233.2,53.6 L236.1,53.8 L239.0,54.0 L241.9,54.1 L244.8,54.1 L247.7,54.1 L250.6,54.0 L253.5,53.9 L256.4,53.8 L259.3,53.6 L262.2,53.3 L265.1,53.0 L268.0,52.7 L270.9,52.3 L273.8,51.8 L276.6,51.3 L279.5,50.8 L282.4,50.2 L285.2,49.5 L288.1,48.8 L290.9,48.1 L293.7,47.3 L296.5,46.5Z\"/><circle class=\"c-sucker\" cx=\"285.2\" cy=\"30.5\" r=\"3.4\"/><circle class=\"c-sucker\" cx=\"272.6\" cy=\"34.3\" r=\"3.2\"/><circle class=\"c-sucker\" cx=\"259.7\" cy=\"37.0\" r=\"3.0\"/><circle class=\"c-sucker\" cx=\"246.6\" cy=\"38.7\" r=\"2.8\"/><circle class=\"c-sucker\" cx=\"233.5\" cy=\"39.2\" r=\"2.6\"/><circle class=\"c-sucker\" cx=\"220.4\" cy=\"38.4\" r=\"2.5\"/><circle class=\"c-sucker\" cx=\"207.5\" cy=\"36.1\" r=\"2.3\"/><circle class=\"c-sucker\" cx=\"195.2\" cy=\"31.9\" r=\"2.0\"/><circle class=\"c-sucker\" cx=\"184.3\" cy=\"25.3\" r=\"1.8\"/><circle class=\"c-sucker\" cx=\"175.9\" cy=\"16.0\" r=\"1.6\"/><circle class=\"c-sucker\" cx=\"172.0\" cy=\"4.3\" r=\"1.4\"/><circle class=\"c-sucker\" cx=\"175.1\" cy=\"-7.3\" r=\"1.1\"/></g></svg>",
    ooze: "<svg viewBox=\"0 0 300 230\" xmlns=\"http://www.w3.org/2000/svg\" focusable=\"false\"><g class=\"c-ooze\"><path class=\"c-body\" d=\"M300.0,0.0C300.0,0.0 302.7,62.3 300.0,76.0C297.3,89.7 288.3,76.0 284.0,82.0C279.7,88.0 277.3,102.3 274.0,112.0C270.7,121.7 267.3,140.0 264.0,140.0C260.7,140.0 257.0,121.3 254.0,112.0C251.0,102.7 250.7,90.3 246.0,84.0C241.3,77.7 232.3,76.3 226.0,74.0C219.7,71.7 212.3,67.7 208.0,70.0C203.7,72.3 202.7,88.0 200.0,88.0C197.3,88.0 196.7,74.7 192.0,70.0C187.3,65.3 178.7,61.7 172.0,60.0C165.3,58.3 156.7,50.3 152.0,60.0C147.3,69.7 147.0,100.7 144.0,118.0C141.0,135.3 137.7,164.0 134.0,164.0C130.3,164.0 125.3,136.0 122.0,118.0C118.7,100.0 118.7,68.3 114.0,56.0C109.3,43.7 101.0,46.7 94.0,44.0C87.0,41.3 78.0,39.3 72.0,40.0C66.0,40.7 61.7,43.7 58.0,48.0C54.3,52.3 52.7,66.3 50.0,66.0C47.3,65.7 46.7,52.0 42.0,46.0C37.3,40.0 29.0,34.3 22.0,30.0C15.0,25.7 0.0,20.0 0.0,20.0C0.0,20.0 0.0,0.0 0.0,0.0C0.0,0.0 300.0,0.0 300.0,0.0Z\"/><path class=\"c-line\" d=\"M286,20 q-10,10 -6,24 M160,16 q-8,8 -4,20 M70,12 q-6,6 -3,14\"/><circle class=\"c-bubble\" cx=\"188\" cy=\"34\" r=\"6\"/><circle class=\"c-bubble\" cx=\"110\" cy=\"26\" r=\"4\" style=\"animation-delay:1.4s\"/><circle class=\"c-bubble\" cx=\"226\" cy=\"52\" r=\"3.5\" style=\"animation-delay:2.6s\"/><circle class=\"c-dark\" cx=\"252\" cy=\"38\" r=\"15\"/><g class=\"c-blink\"><circle class=\"c-glow\" cx=\"252\" cy=\"38\" r=\"11\"/><circle class=\"c-pupil\" cx=\"252\" cy=\"38\" r=\"5\"/></g></g><ellipse class=\"c-drip\" cx=\"264\" cy=\"144\" rx=\"4\" ry=\"5.5\" style=\"animation-delay:0s\"/><ellipse class=\"c-drip\" cx=\"134\" cy=\"168\" rx=\"4.5\" ry=\"6\" style=\"animation-delay:1.7s\"/><ellipse class=\"c-drip\" cx=\"50\" cy=\"70\" rx=\"3\" ry=\"4\" style=\"animation-delay:3.1s\"/><ellipse class=\"c-drip\" cx=\"200\" cy=\"92\" rx=\"3\" ry=\"4\" style=\"animation-delay:4.2s\"/></svg>",
    raven: "<svg viewBox=\"0 0 210 196\" xmlns=\"http://www.w3.org/2000/svg\" focusable=\"false\"><path class=\"c-branch\" d=\"M40,168 C90,160 150,166 210,158 M150,164 l22,-20 M84,164 l-14,16\"/><g class=\"c-tilt\" style=\"transform-origin:110px 150px\"><path class=\"c-line\" d=\"M104,138 l-4,26 l-8,5 M100,164 l8,5 M120,140 l-2,24 l-8,5 M118,164 l8,5\"/><path class=\"c-body\" d=\"M14.0,62.0C14.0,62.0 31.0,58.0 38.0,54.0C45.0,50.0 49.3,41.5 56.0,38.0C62.7,34.5 71.0,31.7 78.0,33.0C85.0,34.3 89.7,39.2 98.0,46.0C106.3,52.8 117.7,63.3 128.0,74.0C138.3,84.7 148.7,95.7 160.0,110.0C171.3,124.3 196.0,160.0 196.0,160.0C196.0,160.0 187.0,167.7 182.0,166.0C177.0,164.3 172.0,153.7 166.0,150.0C160.0,146.3 154.0,145.3 146.0,144.0C138.0,142.7 127.3,143.7 118.0,142.0C108.7,140.3 98.7,138.7 90.0,134.0C81.3,129.3 72.3,121.3 66.0,114.0C59.7,106.7 55.3,97.0 52.0,90.0C48.7,83.0 48.7,75.7 46.0,72.0C43.3,68.3 41.3,69.7 36.0,68.0C30.7,66.3 14.0,62.0 14.0,62.0Z\"/><path class=\"c-line\" d=\"M84,74 C106,76 134,98 158,130 C132,126 106,114 92,98\"/><path class=\"c-line\" d=\"M36,61 L16,62.5\"/><g class=\"c-blink\"><circle class=\"c-glow\" cx=\"64\" cy=\"50\" r=\"3.6\"/></g></g></svg>",
    bat: "<svg viewBox=\"0 0 120 56\" xmlns=\"http://www.w3.org/2000/svg\" focusable=\"false\"><g class=\"c-flapL\"><path class=\"c-body\" d=\"M55,27 C45,11 27,8 3,14 C13,20 16,28 12,37 C22,30 30,32 34,41 C40,33 48,33 55,39 Z\"/></g><g transform=\"translate(120 0) scale(-1 1)\"><g class=\"c-flapL\"><path class=\"c-body\" d=\"M55,27 C45,11 27,8 3,14 C13,20 16,28 12,37 C22,30 30,32 34,41 C40,33 48,33 55,39 Z\"/></g></g><path class=\"c-body\" d=\"M60,18 C66,20 67,34 60,44 C53,34 54,20 60,18Z M55,20 L53,11 L59,17Z M65,20 L67,11 L61,17Z\"/><circle class=\"c-glow\" cx=\"57.6\" cy=\"23\" r=\"1.2\"/><circle class=\"c-glow\" cx=\"62.4\" cy=\"23\" r=\"1.2\"/></svg>",
    bats: "<svg viewBox=\"0 0 280 130\" xmlns=\"http://www.w3.org/2000/svg\" focusable=\"false\"><path class=\"c-branch\" d=\"M20,12 C90,4 180,14 280,8\"/><g transform=\"translate(70 12) scale(0.8)\"><g class=\"c-hang\" style=\"animation-delay:-0.6s\"><path class=\"c-body\" d=\"M-3.0,0.0C-3.0,0.0 3.0,0.0 3.0,0.0C3.0,0.0 9.3,8.3 11.0,14.0C12.7,19.7 13.5,27.3 13.0,34.0C12.5,40.7 8.7,49.0 8.0,54.0C7.3,59.0 9.7,61.0 9.0,64.0C8.3,67.0 6.2,70.7 4.0,72.0C1.8,73.3 -1.8,73.3 -4.0,72.0C-6.2,70.7 -8.3,67.0 -9.0,64.0C-9.7,61.0 -7.3,59.0 -8.0,54.0C-8.7,49.0 -12.5,40.7 -13.0,34.0C-13.5,27.3 -12.7,19.7 -11.0,14.0C-9.3,8.3 -3.0,0.0 -3.0,0.0Z\"/><path class=\"c-body\" d=\"M-7,70 L-9,82 L-2,73Z M7,70 L9,82 L2,73Z\"/><path class=\"c-line\" d=\"M-12,22 Q-3,40 -6,56 M12,22 Q3,40 6,56 M0,6 V50\"/></g></g><g transform=\"translate(124 12) scale(1.15)\"><g class=\"c-hang\" style=\"animation-delay:-2.2s\"><path class=\"c-body\" d=\"M-3.0,0.0C-3.0,0.0 3.0,0.0 3.0,0.0C3.0,0.0 9.3,8.3 11.0,14.0C12.7,19.7 13.5,27.3 13.0,34.0C12.5,40.7 8.7,49.0 8.0,54.0C7.3,59.0 9.7,61.0 9.0,64.0C8.3,67.0 6.2,70.7 4.0,72.0C1.8,73.3 -1.8,73.3 -4.0,72.0C-6.2,70.7 -8.3,67.0 -9.0,64.0C-9.7,61.0 -7.3,59.0 -8.0,54.0C-8.7,49.0 -12.5,40.7 -13.0,34.0C-13.5,27.3 -12.7,19.7 -11.0,14.0C-9.3,8.3 -3.0,0.0 -3.0,0.0Z\"/><path class=\"c-body\" d=\"M-7,70 L-9,82 L-2,73Z M7,70 L9,82 L2,73Z\"/><path class=\"c-line\" d=\"M-12,22 Q-3,40 -6,56 M12,22 Q3,40 6,56 M0,6 V50\"/><g class=\"c-blink\" style=\"animation-delay:2.2s\"><circle class=\"c-glow\" cx=\"-3.4\" cy=\"64\" r=\"1.7\"/><circle class=\"c-glow\" cx=\"3.4\" cy=\"64\" r=\"1.7\"/></g></g></g><g transform=\"translate(176 12) scale(0.9)\"><g class=\"c-hang\" style=\"animation-delay:-1.1s\"><path class=\"c-body\" d=\"M-3.0,0.0C-3.0,0.0 3.0,0.0 3.0,0.0C3.0,0.0 9.3,8.3 11.0,14.0C12.7,19.7 13.5,27.3 13.0,34.0C12.5,40.7 8.7,49.0 8.0,54.0C7.3,59.0 9.7,61.0 9.0,64.0C8.3,67.0 6.2,70.7 4.0,72.0C1.8,73.3 -1.8,73.3 -4.0,72.0C-6.2,70.7 -8.3,67.0 -9.0,64.0C-9.7,61.0 -7.3,59.0 -8.0,54.0C-8.7,49.0 -12.5,40.7 -13.0,34.0C-13.5,27.3 -12.7,19.7 -11.0,14.0C-9.3,8.3 -3.0,0.0 -3.0,0.0Z\"/><path class=\"c-body\" d=\"M-7,70 L-9,82 L-2,73Z M7,70 L9,82 L2,73Z\"/><path class=\"c-line\" d=\"M-12,22 Q-3,40 -6,56 M12,22 Q3,40 6,56 M0,6 V50\"/></g></g><g transform=\"translate(226 12) scale(1.3)\"><g class=\"c-hang\" style=\"animation-delay:-3.4s\"><path class=\"c-body\" d=\"M-3.0,0.0C-3.0,0.0 3.0,0.0 3.0,0.0C3.0,0.0 9.3,8.3 11.0,14.0C12.7,19.7 13.5,27.3 13.0,34.0C12.5,40.7 8.7,49.0 8.0,54.0C7.3,59.0 9.7,61.0 9.0,64.0C8.3,67.0 6.2,70.7 4.0,72.0C1.8,73.3 -1.8,73.3 -4.0,72.0C-6.2,70.7 -8.3,67.0 -9.0,64.0C-9.7,61.0 -7.3,59.0 -8.0,54.0C-8.7,49.0 -12.5,40.7 -13.0,34.0C-13.5,27.3 -12.7,19.7 -11.0,14.0C-9.3,8.3 -3.0,0.0 -3.0,0.0Z\"/><path class=\"c-body\" d=\"M-7,70 L-9,82 L-2,73Z M7,70 L9,82 L2,73Z\"/><path class=\"c-line\" d=\"M-12,22 Q-3,40 -6,56 M12,22 Q3,40 6,56 M0,6 V50\"/><g class=\"c-blink\" style=\"animation-delay:3.4s\"><circle class=\"c-glow\" cx=\"-3.4\" cy=\"64\" r=\"1.7\"/><circle class=\"c-glow\" cx=\"3.4\" cy=\"64\" r=\"1.7\"/></g></g></g></svg>",
    eyes: "<svg viewBox=\"0 0 74 30\" xmlns=\"http://www.w3.org/2000/svg\" focusable=\"false\"><g transform=\"rotate(10 17 15)\"><g class=\"c-blink\" style=\"animation-delay:0.0s\"><path class=\"c-glow\" d=\"M2.0,15.0 Q17.0,5.5 32.0,15.0 Q17.0,24.5 2.0,15.0Z\"/><ellipse class=\"c-pupil\" cx=\"17\" cy=\"15\" rx=\"2.2\" ry=\"4.5\"/></g></g><g transform=\"rotate(-10 57 15)\"><g class=\"c-blink\" style=\"animation-delay:0.05s\"><path class=\"c-glow\" d=\"M42.0,15.0 Q57.0,5.5 72.0,15.0 Q57.0,24.5 42.0,15.0Z\"/><ellipse class=\"c-pupil\" cx=\"57\" cy=\"15\" rx=\"2.2\" ry=\"4.5\"/></g></g></svg>",
    lair: "<svg viewBox=\"0 0 300 190\" xmlns=\"http://www.w3.org/2000/svg\" focusable=\"false\"><path class=\"c-claw\" d=\"M22,58 C42,96 44,134 32,172 C52,134 50,94 22,58Z\"/><path class=\"c-claw\" d=\"M50,58 C70,96 72,134 60,172 C80,134 78,94 50,58Z\"/><path class=\"c-claw\" d=\"M78,58 C98,96 100,134 88,172 C108,134 106,94 78,58Z\"/><g transform=\"translate(150 20) scale(1.25)\"><g transform=\"rotate(10 17 15)\"><g class=\"c-blink\" style=\"animation-delay:0s\"><path class=\"c-glow\" d=\"M2.0,15.0 Q17.0,5.5 32.0,15.0 Q17.0,24.5 2.0,15.0Z\"/><ellipse class=\"c-pupil\" cx=\"17\" cy=\"15\" rx=\"2.2\" ry=\"4.5\"/></g></g><g transform=\"rotate(-10 57 15)\"><g class=\"c-blink\" style=\"animation-delay:0.05s\"><path class=\"c-glow\" d=\"M42.0,15.0 Q57.0,5.5 72.0,15.0 Q57.0,24.5 42.0,15.0Z\"/><ellipse class=\"c-pupil\" cx=\"57\" cy=\"15\" rx=\"2.2\" ry=\"4.5\"/></g></g></g><g transform=\"translate(232 74) scale(0.8)\"><g transform=\"rotate(10 17 15)\"><g class=\"c-blink\" style=\"animation-delay:2.3s\"><path class=\"c-glow\" d=\"M2.0,15.0 Q17.0,5.5 32.0,15.0 Q17.0,24.5 2.0,15.0Z\"/><ellipse class=\"c-pupil\" cx=\"17\" cy=\"15\" rx=\"3.4\" ry=\"3.4\"/></g></g><g transform=\"rotate(-10 57 15)\"><g class=\"c-blink\" style=\"animation-delay:2.3499999999999996s\"><path class=\"c-glow\" d=\"M42.0,15.0 Q57.0,5.5 72.0,15.0 Q57.0,24.5 42.0,15.0Z\"/><ellipse class=\"c-pupil\" cx=\"57\" cy=\"15\" rx=\"3.4\" ry=\"3.4\"/></g></g></g><g transform=\"translate(118 96) scale(0.62)\"><g transform=\"rotate(10 17 15)\"><g class=\"c-blink\" style=\"animation-delay:4.1s\"><path class=\"c-glow\" d=\"M2.0,15.0 Q17.0,5.5 32.0,15.0 Q17.0,24.5 2.0,15.0Z\"/><ellipse class=\"c-pupil\" cx=\"17\" cy=\"15\" rx=\"2.2\" ry=\"4.5\"/></g></g><g transform=\"rotate(-10 57 15)\"><g class=\"c-blink\" style=\"animation-delay:4.1499999999999995s\"><path class=\"c-glow\" d=\"M42.0,15.0 Q57.0,5.5 72.0,15.0 Q57.0,24.5 42.0,15.0Z\"/><ellipse class=\"c-pupil\" cx=\"57\" cy=\"15\" rx=\"2.2\" ry=\"4.5\"/></g></g></g><g transform=\"translate(206 128) scale(1.0)\"><g transform=\"rotate(10 17 15)\"><g class=\"c-blink\" style=\"animation-delay:1.2s\"><path class=\"c-glow\" d=\"M2.0,15.0 Q17.0,5.5 32.0,15.0 Q17.0,24.5 2.0,15.0Z\"/><ellipse class=\"c-pupil\" cx=\"17\" cy=\"15\" rx=\"2.2\" ry=\"4.5\"/></g></g><g transform=\"rotate(-10 57 15)\"><g class=\"c-blink\" style=\"animation-delay:1.25s\"><path class=\"c-glow\" d=\"M42.0,15.0 Q57.0,5.5 72.0,15.0 Q57.0,24.5 42.0,15.0Z\"/><ellipse class=\"c-pupil\" cx=\"57\" cy=\"15\" rx=\"2.2\" ry=\"4.5\"/></g></g></g><g transform=\"translate(20 14) scale(0.5)\"><g transform=\"rotate(10 17 15)\"><g class=\"c-blink\" style=\"animation-delay:3.3s\"><path class=\"c-glow\" d=\"M2.0,15.0 Q17.0,5.5 32.0,15.0 Q17.0,24.5 2.0,15.0Z\"/><ellipse class=\"c-pupil\" cx=\"17\" cy=\"15\" rx=\"3.4\" ry=\"3.4\"/></g></g><g transform=\"rotate(-10 57 15)\"><g class=\"c-blink\" style=\"animation-delay:3.3499999999999996s\"><path class=\"c-glow\" d=\"M42.0,15.0 Q57.0,5.5 72.0,15.0 Q57.0,24.5 42.0,15.0Z\"/><ellipse class=\"c-pupil\" cx=\"57\" cy=\"15\" rx=\"3.4\" ry=\"3.4\"/></g></g></g></svg>",
    wisps: "<svg viewBox=\"0 0 280 190\" xmlns=\"http://www.w3.org/2000/svg\" focusable=\"false\"><g class=\"c-wisp c-wisp-a\" style=\"animation-delay:-0s\"><circle class=\"c-halo\" cx=\"200\" cy=\"50\" r=\"27.2\"/><path class=\"c-tail\" d=\"M200,50 q12.8,17.6 0,36.8 q-12.8,-19.2 0,-36.8\"/><circle class=\"c-glow\" cx=\"200\" cy=\"50\" r=\"8\"/></g><g class=\"c-wisp c-wisp-b\" style=\"animation-delay:-1.5s\"><circle class=\"c-halo\" cx=\"110\" cy=\"86\" r=\"20.4\"/><path class=\"c-tail\" d=\"M110,86 q9.600000000000001,13.200000000000001 0,27.599999999999998 q-9.600000000000001,-14.399999999999999 0,-27.599999999999998\"/><circle class=\"c-glow\" cx=\"110\" cy=\"86\" r=\"6\"/></g><g class=\"c-wisp c-wisp-c\" style=\"animation-delay:-3s\"><circle class=\"c-halo\" cx=\"236\" cy=\"122\" r=\"17.0\"/><path class=\"c-tail\" d=\"M236,122 q8.0,11.0 0,23.0 q-8.0,-12.0 0,-23.0\"/><circle class=\"c-glow\" cx=\"236\" cy=\"122\" r=\"5\"/></g><g class=\"c-wisp c-wisp-a\" style=\"animation-delay:-2.2s\"><circle class=\"c-halo\" cx=\"54\" cy=\"40\" r=\"13.6\"/><path class=\"c-tail\" d=\"M54,40 q6.4,8.8 0,18.4 q-6.4,-9.6 0,-18.4\"/><circle class=\"c-glow\" cx=\"54\" cy=\"40\" r=\"4\"/></g><g class=\"c-wisp c-wisp-b\" style=\"animation-delay:-4s\"><circle class=\"c-halo\" cx=\"160\" cy=\"140\" r=\"15.299999999999999\"/><path class=\"c-tail\" d=\"M160,140 q7.2,9.9 0,20.7 q-7.2,-10.799999999999999 0,-20.7\"/><circle class=\"c-glow\" cx=\"160\" cy=\"140\" r=\"4.5\"/></g></svg>",
    flyer: "<svg viewBox=\"0 0 300 300\" xmlns=\"http://www.w3.org/2000/svg\" focusable=\"false\"><g class=\"c-wingU\" style=\"transform-origin:150px 150px\"><path class=\"c-body\" d=\"M100.0,140.0C100.0,140.0 99.7,117.7 112.0,96.0C124.3,74.3 174.0,10.0 174.0,10.0C174.0,10.0 175.0,64.3 184.0,70.0C193.0,75.7 228.0,44.0 228.0,44.0C228.0,44.0 214.3,89.0 220.0,96.0C225.7,103.0 262.0,86.0 262.0,86.0C262.0,86.0 247.3,114.3 238.0,124.0C228.7,133.7 206.0,144.0 206.0,144.0C206.0,144.0 100.0,140.0 100.0,140.0Z\"/><path class=\"c-line\" d=\"M112,134 L174,12 M118,136 L228,46 M130,138 L262,88\"/></g><g class=\"c-wingD\" style=\"transform-origin:150px 150px\"><g transform=\"translate(0 300) scale(1 -1)\"><path class=\"c-body\" d=\"M100.0,140.0C100.0,140.0 99.7,117.7 112.0,96.0C124.3,74.3 174.0,10.0 174.0,10.0C174.0,10.0 175.0,64.3 184.0,70.0C193.0,75.7 228.0,44.0 228.0,44.0C228.0,44.0 214.3,89.0 220.0,96.0C225.7,103.0 262.0,86.0 262.0,86.0C262.0,86.0 247.3,114.3 238.0,124.0C228.7,133.7 206.0,144.0 206.0,144.0C206.0,144.0 100.0,140.0 100.0,140.0Z\"/><path class=\"c-line\" d=\"M112,134 L174,12 M118,136 L228,46 M130,138 L262,88\"/></g></g><path class=\"c-body\" d=\"M10.0,150.0C10.0,150.0 22.3,141.2 28.0,140.0C33.7,138.8 35.7,142.0 44.0,143.0C52.3,144.0 67.3,147.5 78.0,146.0C88.7,144.5 96.0,136.5 108.0,134.0C120.0,131.5 136.3,130.0 150.0,131.0C163.7,132.0 176.7,137.5 190.0,140.0C203.3,142.5 217.3,144.7 230.0,146.0C242.7,147.3 257.3,149.5 266.0,148.0C274.7,146.5 282.0,137.0 282.0,137.0C282.0,137.0 298.0,150.0 298.0,150.0C298.0,150.0 282.0,163.0 282.0,163.0C282.0,163.0 274.7,153.5 266.0,152.0C257.3,150.5 242.7,152.7 230.0,154.0C217.3,155.3 203.3,157.5 190.0,160.0C176.7,162.5 163.7,168.0 150.0,169.0C136.3,170.0 120.0,168.5 108.0,166.0C96.0,163.5 88.7,155.5 78.0,154.0C67.3,152.5 52.3,156.0 44.0,157.0C35.7,158.0 33.7,161.2 28.0,160.0C22.3,158.8 10.0,150.0 10.0,150.0Z\"/><path class=\"c-body\" d=\"M24,142 L36,128 L38,142Z M24,158 L36,172 L38,158Z\"/></svg>"
  }/*ART:end*/;

  var EMBER = 'var(--cw-accent-text, var(--fod-accent-text, #e85a6a))';
  var BRASS = 'var(--fog-brass, #d4a853)';
  var ARCANE = 'var(--fog-arcane, #4fc2b0)';
  var MIST = 'var(--fog-mist, #a68ae0)';
  var FLAME = 'var(--fog-flame, #ff7a45)';
  var AZURE = 'var(--fog-azure, #5aa9e6)';
  var VERDANT = 'var(--fog-verdant, #6fbf73)';

  // Who lives where: [selector inside the content area, creature, accent]. The first match wins.
  var RESIDENTS = [
    ['.cw-overview', 'dragon', EMBER],
    ['.cw-feed', 'raven', AZURE],
    ['.cw-meetings', 'bats', AZURE],
    ['.cw-members', 'owlbear', BRASS],
    ['.cw-characters', 'owlbear', BRASS],
    ['.cw-combat', 'skull', FLAME],
    ['.cw-map', 'kraken', VERDANT],
    ['.cw-music', 'wisps', ARCANE],
    ['.cw-content', 'spider', BRASS],
    ['.cw-page.cw-memories', 'wraith', MIST],
    ['.cw-bestiary', 'lair', VERDANT],
    ['.cw-foggy', 'wisps', MIST],
    ['.cw-settings', 'bats', EMBER],
    ['.campaigns-page-container', 'dragon', EMBER],
    ['.create-campaign-wrapper', 'dragon', EMBER],
    ['.characters-page', 'owlbear', BRASS],
    ['.character-sheet-page', 'owlbear', BRASS],
    ['.character-wizard-page', 'owlbear', BRASS],
    ['.music-page', 'wisps', ARCANE],
    ['.adventures-page', 'spider', BRASS],
    ['.adventure-editor-page', 'spider', BRASS],
    ['.adventure-reader-page', 'spider', BRASS],
    ['.compendium-page', 'lair', VERDANT],
    ['.homebrew-page', 'ooze', FLAME],
    ['.homebrew-editor-page', 'ooze', FLAME],
    ['.marketplace-page', 'mimic', BRASS],
    ['.billing-page', 'mimic', AZURE],
    ['.upgrade-page-container', 'mimic', BRASS],
    ['.foggy-page', 'wisps', MIST],
    ['.settings-page', 'bats', EMBER],
    ['.profile-wrapper', 'raven', EMBER],
    ['.edit-profile-body', 'raven', EMBER]
  ];

  var script = document.currentScript;
  var root = script && script.src ? script.src.replace(/JS\/fog-creatures\.js.*$/, '') : '';
  var motion = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  function still() { return !!motion.matches; }
  function rand(a, b) { return a + Math.random() * (b - a); }

  function loadStyles() {
    if (document.querySelector('link[data-fog-creatures]')) return;
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = root + 'Styles/creatures.css';
    link.setAttribute('data-fog-creatures', '');
    document.head.appendChild(link);
  }

  function make(cls) {
    var el = document.createElement('span');
    el.className = cls;
    el.setAttribute('aria-hidden', 'true');
    return el;
  }

  // Draw a creature into an element. The markup is the static art above, never page or user content.
  function draw(el, name) {
    if (!el || !ART[name]) return false;
    el.innerHTML = ART[name];
    el.classList.add('fog-creature');
    el.setAttribute('data-creature', name);
    el.setAttribute('aria-hidden', 'true');
    return true;
  }

  /* ---------- the resident: one creature per section, at the top right of the page ----------
     It scrolls with the page and sits in front of it, so it checks what is underneath: if it would touch text,
     a control or a picture it moves left of it, then tries a smaller size, and otherwise fades to a faint shape. */
  var lair = null, resident = null, sky = null, current = '', currentAccent = '', swapTimer = 0;
  var FLUSH = { dragon: 1, kraken: 1, ooze: 1, spider: 1 };    // these come in from the edge of the window
  var HANG = { ooze: 1, spider: 1, bats: 1 };                  // these hang from the top of the page

  function shellHost() { return document.getElementById('campaign-content') || document.getElementById('page-content'); }

  function pick(host) {
    for (var i = 0; i < RESIDENTS.length; i++) {
      if (host.querySelector(RESIDENTS[i][0])) return RESIDENTS[i];
    }
    return null;
  }

  var CONTROLS = 'a, button, input, select, textarea, label, summary, [role="tab"], [role="button"], [contenteditable="true"]';

  // Is there something to read, press or look at under this point of the page?
  function busyAt(x, y) {
    var el = document.elementFromPoint(x, y);
    if (!el || el === document.body || el === document.documentElement) return false;
    if (el.closest(CONTROLS)) return true;
    var tag = el.tagName;
    if (tag === 'IMG' || tag === 'VIDEO' || tag === 'CANVAS' || el.ownerSVGElement || tag === 'svg') return true;
    var hasText = false;
    for (var n = el.firstChild; n; n = n.nextSibling) {
      if (n.nodeType === 3 && /\S/.test(n.nodeValue)) { hasText = true; break; }
    }
    if (!hasText) return false;
    var range = document.createRange();
    range.selectNodeContents(el);
    var rects = range.getClientRects();
    for (var i = 0; i < rects.length; i++) {
      var b = rects[i];
      if (x >= b.left - 12 && x <= b.right + 12 && y >= b.top - 8 && y <= b.bottom + 8) return true;
    }
    return false;
  }

  // Sample the creature's box (page coordinates). Returns null when the box is not on screen, so nothing can be told.
  function probe(left, top, w, h) {
    var sx = window.scrollX, sy = window.scrollY, vw = document.documentElement.clientWidth, vh = window.innerHeight;
    var hits = 0, minX = Infinity, seen = 0;
    for (var r = 0; r < 8; r++) {
      for (var c = 0; c < 10; c++) {
        var x = left + w * (0.04 + 0.92 * c / 9) - sx, y = top + h * (0.05 + 0.9 * r / 7) - sy;
        if (x < 0 || y < 0 || x >= vw || y >= vh) continue;
        seen++;
        if (busyAt(x, y)) { hits++; if (x + sx < minX) minX = x + sx; }
      }
    }
    return seen < 30 ? null : { hits: hits, minX: minX };
  }

  function place() {
    var host = shellHost();
    if (!host || !resident || !current) return;
    var box = host.getBoundingClientRect(), cs = window.getComputedStyle(host);
    var vw = document.documentElement.clientWidth;
    var top = Math.round(box.top + window.scrollY) + (HANG[current] ? 0 : 6);
    var edge = FLUSH[current] ? vw : Math.min(vw - 8, box.right - (parseFloat(cs.paddingRight) || 0));
    resident.style.width = '';
    resident.classList.remove('is-shy');
    var w = resident.offsetWidth, ratio = resident.offsetHeight / Math.max(1, w);
    var left = edge - w;

    function put(l, width) {
      resident.style.left = Math.round(l) + 'px';
      resident.style.top = top + 'px';
      if (width) resident.style.width = Math.round(width) + 'px';
    }

    put(left, 0);
    var found = probe(left, top, w, w * ratio);
    if (!found || !found.hits) return;

    // 1. move to the left of whatever is in the way, staying in the right half of the page
    var moved = found.minX - 16 - w;
    if (moved > box.left + box.width * 0.45) {
      var again = probe(moved, top, w, w * ratio);
      if (again && !again.hits) { put(moved, 0); return; }
    }
    // 2. a smaller creature in the corner
    var small = w * 0.6;
    var third = probe(edge - small, top, small, small * ratio);
    if (third && !third.hits) { put(edge - small, small); return; }
    // 3. a faint shape that does not get in the way of reading
    put(left, 0);
    resident.classList.add('is-shy');
  }

  function settle() {
    var host = shellHost();
    if (!host || !resident) return;
    var found = pick(host);
    var name = found ? found[1] : '';
    if (name === current) { place(); return; }
    var wasEmpty = !current;
    current = name;
    currentAccent = found ? found[2] : '';
    resident.classList.remove('is-in');
    clearTimeout(swapTimer);
    swapTimer = setTimeout(function () {
      if (!name) {
        resident.innerHTML = '';
        resident.removeAttribute('data-creature');
        document.documentElement.classList.remove('fog-has-resident');
        return;
      }
      draw(resident, name);
      resident.style.setProperty('--cr', currentAccent);
      document.documentElement.classList.add('fog-has-resident');
      place();
      requestAnimationFrame(function () { requestAnimationFrame(function () { resident.classList.add('is-in'); }); });
    }, wasEmpty ? 0 : 340);
  }

  var settleTimer = 0;
  function settleSoon() { clearTimeout(settleTimer); settleTimer = setTimeout(settle, 120); }

  /* ---------- the lair: behind the content. Eyes open in the gaps of the page, embers rise ---------- */
  function lurk(el) {
    function open() {
      el.style.left = rand(34, 93).toFixed(1) + 'vw';
      el.style.top = rand(46, 92).toFixed(1) + 'vh';
      el.style.width = Math.round(rand(40, 78)) + 'px';
      el.classList.add('is-open');
      setTimeout(close, rand(6000, 11000));
    }
    function close() {
      el.classList.remove('is-open');
      setTimeout(open, rand(3500, 10000));
    }
    if (still()) { el.style.left = '88vw'; el.style.top = '86vh'; el.style.width = '56px'; el.classList.add('is-open'); return; }
    setTimeout(open, rand(1500, 6000));
  }

  function buildLair() {
    lair = make('fog-lair');
    lair.appendChild(make('fog-embers'));
    lair.appendChild(make('fog-embers fog-embers-b'));
    for (var i = 0; i < 2; i++) {
      var eyes = make('fog-lurker');
      draw(eyes, 'eyes');
      lair.appendChild(eyes);
      lurk(eyes);
    }
    document.body.insertBefore(lair, document.body.firstChild);

    resident = make('fog-resident');
    document.body.appendChild(resident);

    var host = shellHost();
    if (window.MutationObserver) new MutationObserver(settleSoon).observe(host, { childList: true });
    if (window.ResizeObserver) new ResizeObserver(settleSoon).observe(host);
    window.addEventListener('hashchange', function () {
      settleSoon();
      setTimeout(settle, 500);
      setTimeout(settle, 1400);
      setTimeout(settle, 3000);
    });
    window.addEventListener('resize', settleSoon);
    settle();
    setTimeout(settle, 600);
    setTimeout(settle, 1600);
    setTimeout(settle, 3600);
  }

  /* ---------- the sky: in front of the page, never in the way ---------- */
  function ensureSky() {
    if (!sky) { sky = make('fog-sky'); document.body.appendChild(sky); }
    return sky;
  }

  function leaveWhenDone(el) {
    el.addEventListener('animationend', function (e) { if (e.target === el && el.parentNode) el.parentNode.removeChild(el); });
  }

  // A few bats cross the upper part of the screen.
  function flock() {
    if (still() || document.hidden) return 0;
    var n = 3 + Math.floor(Math.random() * 3), back = Math.random() < 0.5, host = ensureSky();
    for (var i = 0; i < n; i++) {
      var bat = make('fog-bat' + (back ? ' is-back' : ''));
      draw(bat, 'bat');
      bat.style.top = rand(8, 34).toFixed(1) + 'vh';
      bat.style.setProperty('--size', Math.round(rand(26, 54)) + 'px');
      bat.style.setProperty('--dur', rand(5, 8).toFixed(2) + 's');
      bat.style.setProperty('--delay', (i * 0.3 + rand(0, 0.5)).toFixed(2) + 's');
      leaveWhenDone(bat);
      host.appendChild(bat);
    }
    return n;
  }

  // The dragon passes overhead.
  function flyover() {
    if (still() || document.hidden) return false;
    var dragon = make('fog-flyover');
    draw(dragon, 'flyer');
    leaveWhenDone(dragon);
    ensureSky().appendChild(dragon);
    return true;
  }

  function every(fn, first, min, max) {
    (function next(delay) {
      setTimeout(function () { fn(); next(rand(min, max)); }, delay);
    })(first);
  }

  /* ---------- eyes follow the pointer, a little ---------- */
  var px = 0, py = 0, frame = 0;
  function look() {
    frame = 0;
    document.documentElement.style.setProperty('--fog-look-x', px.toFixed(2));
    document.documentElement.style.setProperty('--fog-look-y', py.toFixed(2));
  }
  var lastLook = 0;
  function onPointer(e) {
    var now = Date.now();
    if (now - lastLook < 120) return; // a few times a second is plenty for a glance
    lastLook = now;
    px = e.clientX / Math.max(1, window.innerWidth) * 2 - 1;
    py = e.clientY / Math.max(1, window.innerHeight) * 2 - 1;
    if (!frame) frame = requestAnimationFrame(look);
  }

  function placeAll(scope) {
    var spots = (scope || document).querySelectorAll('[data-fog-creature]');
    for (var i = 0; i < spots.length; i++) {
      if (!spots[i].firstChild) draw(spots[i], spots[i].getAttribute('data-fog-creature'));
    }
  }

  function start() {
    loadStyles();
    placeAll(document);
    if (shellHost()) buildLair();
    if (!still()) {
      window.addEventListener('pointermove', onPointer, { passive: true });
      if (!document.body.hasAttribute('data-fog-quiet-sky')) {
        setTimeout(flyover, 1600);
        every(flyover, rand(150000, 240000), 150000, 280000);
        every(flock, rand(9000, 16000), 50000, 110000);
      }
    }
  }

  window.FogCreatures = {
    names: function () { return Object.keys(ART); },
    draw: draw,
    place: placeAll,
    settle: settle,
    flock: flock,
    flyover: flyover
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
