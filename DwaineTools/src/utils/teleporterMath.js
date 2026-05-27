export function calculateTeleporterVariables(inputs) {
  const requiredKeys = ['tx1', 'ty1', 'rx1', 'ry1', 'rx2', 'ry2'];
  if (!inputs.assumeOneTile) {
    requiredKeys.push('tx2', 'ty2');
  }
  const isReady = requiredKeys.every(key => inputs[key] !== '' && !isNaN(parseFloat(inputs[key])));

  const n = Object.keys(inputs).reduce((acc, key) => {
    acc[key] = key === 'assumeOneTile' ? inputs[key] : (parseFloat(inputs[key]) || 0);
    return acc;
  }, {});

  if (!isReady) {
    return { ...n, mx: '-', my: '-', xoff: '-', yoff: '-', tx2: '-', ty2: '-' };
  }

  let tx2_val, ty2_val;
  if (n.assumeOneTile) {
    tx2_val = n.tx1 + 1;
    ty2_val = n.ty1 + 1;
  } else {
    tx2_val = n.tx2;
    ty2_val = n.ty2;
  }

  const dx = (tx2_val - n.tx1) || 1; // Fallback to 1 to prevent division by zero
  const dy = (ty2_val - n.ty1) || 1;

  const mx = (n.rx2 - n.rx1) / dx;
  const my = (n.ry2 - n.ry1) / dy;
  const xoff = (mx * n.tx1 - n.rx1) * -1;
  const yoff = (my * n.ty1 - n.ry1) * -1;

  return { ...n, mx, my, xoff, yoff, tx2: tx2_val, ty2: ty2_val };
}

export function validateCalibration(calc, teleporterNumber, stationZ) {
  const isMxInvalid = calc.mx !== '-' && ![1, 2, 4].includes(calc.mx);
  const isMyInvalid = calc.my !== '-' && ![1, 2, 4].includes(calc.my);
  const isXoffInvalid = calc.xoff !== '-' && (calc.xoff < -100 || calc.xoff > 0 || !Number.isInteger(calc.xoff));
  const isYoffInvalid = calc.yoff !== '-' && (calc.yoff < -100 || calc.yoff > 0 || !Number.isInteger(calc.yoff));
  const hasWarning = isMxInvalid || isMyInvalid || isXoffInvalid || isYoffInvalid;
  
  const isCalibrationComplete = calc.mx !== '-' && teleporterNumber !== '' && stationZ !== '';

  return {
    isMxInvalid,
    isMyInvalid,
    isXoffInvalid,
    isYoffInvalid,
    hasWarning,
    isCalibrationComplete
  };
}
