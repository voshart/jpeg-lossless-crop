/** EXIF transforms act on rectangle edges, not pixel-centre indices. */
function matrix(info) {
  const { width: w, height: h, orientation: o } = info;
  return [null, [1,0,0,1,0,0], [-1,0,0,1,w,0], [-1,0,0,-1,w,h],
    [1,0,0,-1,0,h], [0,1,1,0,0,0], [0,1,-1,0,h,0],
    [0,-1,-1,0,h,w], [0,-1,1,0,0,w]][o];
}
function transformRect(r, m) {
  const [a,b,c,d,e,f] = m;
  const points = [[r.x,r.y], [r.x+r.width,r.y], [r.x,r.y+r.height], [r.x+r.width,r.y+r.height]];
  const xs = points.map(([x,y]) => a*x+c*y+e), ys = points.map(([x,y]) => b*x+d*y+f);
  const x = Math.min(...xs), y = Math.min(...ys);
  return { x, y, width: Math.max(...xs)-x, height: Math.max(...ys)-y };
}
export function rawToDisplay(rect, info) { return transformRect(rect, matrix(info)); }
export function displayToRaw(rect, info) {
  const [a,b,c,d,e,f] = matrix(info), det = a*d-b*c;
  return transformRect(rect, [d/det,-b/det,-c/det,a/det,(c*f-d*e)/det,(b*e-a*f)/det]);
}
export function snapCrop(rect, info) {
  if (![rect.x, rect.y, rect.width, rect.height].every(Number.isFinite) || rect.width <= 0 || rect.height <= 0) {
    throw new Error('Enter a positive crop width and height and finite coordinates.');
  }
  const r = displayToRaw(rect, info), { width: w, height: h, mcuWidth: mw, mcuHeight: mh } = info;
  const left = Math.max(0, r.x), top = Math.max(0, r.y);
  const right = Math.min(w, Math.round(r.x+r.width));
  const bottom = Math.min(h, Math.round(r.y+r.height));
  if (right <= left || bottom <= top) throw new Error('The crop must intersect the image.');
  const x = Math.floor(left/mw)*mw, y = Math.floor(top/mh)*mh;
  // JPEG dimensions can stop inside the final iMCU without changing its coefficients.
  const raw = { x, y, width: right-x, height: bottom-y };
  return { raw, display: rawToDisplay(raw, info) };
}
