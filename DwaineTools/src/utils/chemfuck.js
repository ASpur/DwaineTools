/**
 * ChemFuck (CBF) emulator core for the Goonstation chemicompiler.
 *
 * Faithful port of /datum/chemicompiler_core + /datum/chemicompiler_executor from
 * goonstation: code/modules/chemistry/machinery/chemicompiler_core.dm
 *
 * Semantics preserved from the DM source:
 * - 1024 cells of RAM; the data pointer wraps at both ends. Cell values are plain
 *   numbers (no 0-255 byte wrapping, negatives allowed).
 * - Registers sx (source), tx (target), ax (amount) exchanged with RAM via {}()^'
 * - Machine executes up to 30 op-cost per tick; T A V N , ] cost 10, the
 *   expensive ops $ @ # * consume the remainder of the tick, everything else costs 1.
 * - Hard limit of 50000 executed instructions per program run.
 * - $ heats reservoir sx toward (T0C - tx) + ax kelvin, max 25K per tick,
 *   repeating itself (ip--) until the target temperature is reached.
 * - * waits for the next reaction tick before continuing.
 * - Reservoirs 1..maxReservoir hold beakers; targets 11/12/13 eject a pill (100u),
 *   a vial (5u), or splash onto the floor (via a 500u ejection tank).
 * - T reads temperature in rounded degrees C; A/, read rounded total volume;
 *   V reads rounded volume of reagent #cell; N reads the reagent count.
 * - Runtime errors (bad reservoir ids, missing beakers, bad temperatures) beep
 *   and skip the operation; they do NOT halt the program.
 *
 * Deliberate deviation: an unmatched ] halts with an UNMATCHED_BRACKET error
 * instead of silently stalling forever like the in-game VM.
 */

export const T0C = 273.15;
export const RAM_SIZE = 1024;
export const MAX_OPERATIONS = 30;
export const EXEC_LIMIT = 50000;
export const HEAT_STEP = 25;
export const PILL_CAPACITY = 100;
export const VIAL_CAPACITY = 5;
export const EJECTION_TANK_CAPACITY = 500;

export const MACHINE_TYPES = {
  stationary: { id: 'stationary', label: 'ChemiCompiler CCS1001', maxReservoir: 10 },
  mini: { id: 'mini', label: 'MiniChemiCompiler', maxReservoir: 6 },
};

export const TOKENS = ['>', '<', '+', '-', '.', ',', 'T', 'A', 'V', 'N', '[', ']', '{', '}', '(', ')', '^', "'", '$', '@', '#', '*'];

export const CC_ERROR = {
  INVALID_SX: 1,
  INVALID_TX: 2,
  INVALID_CONTAINER_SX: 3,
  INVALID_CONTAINER_TX: 4,
  INVALID_TEMPERATURE: 5,
  CODE_PROTECTED: 6,
  INSTRUCTION_LIMIT: 7,
  INDEX_INVALID: 8,
  MANUAL_ABORT: 9,
  NOTIFICATION_COMPLETE: 101,
  NOTIFICATION_SAVED: 102,
  UNMATCHED_BRACKET: -1,
};

export const ERROR_MESSAGES = {
  [CC_ERROR.INVALID_SX]: 'Invalid source reservoir id.',
  [CC_ERROR.INVALID_TX]: 'Invalid target reservoir id.',
  [CC_ERROR.INVALID_CONTAINER_SX]: 'Invalid or missing container in source reservoir slot.',
  [CC_ERROR.INVALID_CONTAINER_TX]: 'Invalid or missing container in target reservoir slot.',
  [CC_ERROR.INVALID_TEMPERATURE]: 'Invalid temperature passed to heat.',
  [CC_ERROR.CODE_PROTECTED]: 'Code protected - cannot retrieve.',
  [CC_ERROR.INSTRUCTION_LIMIT]: 'Instruction limit reached.',
  [CC_ERROR.INDEX_INVALID]: 'Invalid isolation index for source reservoir.',
  [CC_ERROR.MANUAL_ABORT]: 'Aborted by user.',
  [CC_ERROR.NOTIFICATION_COMPLETE]: 'Program complete.',
  [CC_ERROR.NOTIFICATION_SAVED]: 'Code saved.',
  [CC_ERROR.UNMATCHED_BRACKET]: 'Unmatched ] - no matching [ found.',
};

/**
 * Tokenize ChemFuck source. Non-token characters are ignored (but beware: the
 * letters T, A, V and N are instructions, so "comments" cannot contain them).
 * A ~ anywhere in the source marks the program as read-protected in game.
 * Returns { ops, sourceMap, isProtected } where sourceMap[i] is the index into
 * the original source of ops[i] (for editor highlighting).
 */
export function parseCBF(source) {
  const ops = [];
  const sourceMap = [];
  let isProtected = false;
  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    if (ch === '~') {
      isProtected = true;
    } else if (TOKENS.includes(ch)) {
      ops.push(ch);
      sourceMap.push(i);
    }
  }
  return { ops, sourceMap, isProtected };
}

let beakerSerial = 0;

export function createBeaker({ name = 'beaker', maxVolume = 50, temperature, temperatureC, contents = [] } = {}) {
  temperature = temperature ?? (temperatureC != null ? T0C + temperatureC : T0C + 20);
  return {
    id: ++beakerSerial,
    name,
    maxVolume,
    temperature,
    contents: contents.map((r) => ({ id: r.id, volume: r.volume })),
  };
}

export function beakerTotalVolume(beaker) {
  return beaker.contents.reduce((sum, r) => sum + r.volume, 0);
}

const VOLUME_EPSILON = 0.0001;

/**
 * Mirrors /datum/reagents/trans_to. Moves up to `amount` units from src to dst
 * (dst may be null = unlimited sink, e.g. the floor). index > 0 isolates the
 * single reagent at that 1-based index. Mixes temperature by weighted average.
 * Returns the volume actually moved (as { moved, contents } describing it).
 */
export function transferContents(src, dst, amount, index = 0) {
  if (amount <= 0) return { moved: 0, contents: [] };
  const srcTotal = beakerTotalVolume(src);
  if (srcTotal <= 0) return { moved: 0, contents: [] };

  const available = index > 0 ? (src.contents[index - 1]?.volume ?? 0) : srcTotal;
  const free = dst ? dst.maxVolume - beakerTotalVolume(dst) : Infinity;
  const moved = Math.min(amount, available, free);
  if (moved <= VOLUME_EPSILON) return { moved: 0, contents: [] };

  const movedContents = [];
  if (index > 0) {
    const reagent = src.contents[index - 1];
    reagent.volume -= moved;
    movedContents.push({ id: reagent.id, volume: moved });
  } else {
    const factor = moved / srcTotal;
    for (const reagent of src.contents) {
      const part = reagent.volume * factor;
      reagent.volume -= part;
      movedContents.push({ id: reagent.id, volume: part });
    }
  }
  src.contents = src.contents.filter((r) => r.volume > VOLUME_EPSILON);

  if (dst) {
    const dstTotal = beakerTotalVolume(dst);
    for (const incoming of movedContents) {
      const existing = dst.contents.find((r) => r.id === incoming.id);
      if (existing) existing.volume += incoming.volume;
      else dst.contents.push({ id: incoming.id, volume: incoming.volume });
    }
    const newTotal = dstTotal + moved;
    if (newTotal > 0) {
      dst.temperature = (dst.temperature * dstTotal + src.temperature * moved) / newTotal;
    }
  }

  return { moved, contents: movedContents };
}

export class ChemfuckVM {
  /**
   * options:
   *   maxReservoir   - 10 (stationary) or 6 (mini)
   *   onEvent        - optional callback(event); events also accumulate in vm.events
   *   onReactionTick - optional callback(vm) fired at every machine tick boundary;
   *                    hook point for plugging in chemical reaction simulation later
   */
  constructor({ maxReservoir = 10, onEvent = null, onReactionTick = null } = {}) {
    this.maxReservoir = maxReservoir;
    this.onEvent = onEvent;
    this.onReactionTick = onReactionTick;
    this.reservoirs = new Array(maxReservoir + 1).fill(null); // 1-based, [0] unused
    this.prog = [];
    this.sourceMap = [];
    this.isProtected = false;
    this.artifacts = [];
    this.events = [];
    this.haltReason = null;
    this.resetVM();
  }

  resetVM() {
    this.dp = 0;
    this.data = new Array(RAM_SIZE).fill(0);
    this.ip = 0; // 0-based index into this.prog (DM uses 1-based)
    this.sx = 0;
    this.tx = 0;
    this.ax = 0;
    this.textBuffer = '';
    this.textOutput = '';
    this.exec = 0;
    this.running = false;
    this.isHeating = false;
    this.awaitingReactionTick = false;
    this.haltReason = null;
  }

  /** Full reset: VM state plus logs and ejected items. Reservoirs are kept. */
  reset() {
    this.resetVM();
    this.artifacts = [];
    this.events = [];
  }

  loadProgram(source) {
    const { ops, sourceMap, isProtected } = parseCBF(source);
    this.prog = ops;
    this.sourceMap = sourceMap;
    this.isProtected = isProtected;
    this.reset();
  }

  start() {
    this.resetVM();
    this.running = true;
    this.emit({ type: 'status', running: true });
  }

  abort() {
    if (!this.running) return;
    this.running = false;
    this.haltReason = 'aborted';
    this.throwError(CC_ERROR.MANUAL_ABORT);
    this.emit({ type: 'status', running: false });
  }

  emit(event) {
    this.events.push(event);
    if (this.onEvent) this.onEvent(event);
  }

  message(text) {
    this.emit({ type: 'message', text });
  }

  say(text) {
    this.emit({ type: 'say', text });
  }

  throwError(code) {
    this.emit({ type: code >= 100 ? 'notification' : 'error', code, text: ERROR_MESSAGES[code] ?? `Unknown error code: ${code}` });
  }

  setReservoir(slot, beaker) {
    if (slot < 1 || slot > this.maxReservoir) return;
    this.reservoirs[slot] = beaker;
  }

  getReservoir(slot) {
    return this.reservoirs[slot] ?? null;
  }

  /** One machine tick: up to MAX_OPERATIONS of op cost, like on_process(). */
  tick() {
    if (!this.running) return;
    if (this.awaitingReactionTick) {
      this.awaitingReactionTick = false;
      if (this.onReactionTick) this.onReactionTick(this);
    }
    let loopUsed = 0;
    while (this.running && !this.awaitingReactionTick && loopUsed < MAX_OPERATIONS) {
      loopUsed += this.step();
    }
  }

  /** Run to completion (or maxTicks). Returns a result summary. */
  run(maxTicks = 100000) {
    if (!this.running) this.start();
    let ticks = 0;
    while (this.running && ticks < maxTicks) {
      this.tick();
      ticks++;
    }
    if (this.running) {
      this.running = false;
      this.haltReason = 'tick-limit';
      this.message(`Emulator stopped: still running after ${maxTicks} ticks.`);
      this.emit({ type: 'status', running: false });
    }
    return {
      ticks,
      haltReason: this.haltReason,
      sayOutput: this.textOutput,
      artifacts: this.artifacts,
      reservoirs: this.reservoirs,
      events: this.events,
    };
  }

  /**
   * Execute a single instruction. Returns its op cost (used by tick()).
   * Mirrors the switch in on_process().
   */
  step() {
    if (!this.running) return MAX_OPERATIONS;
    if (this.ip >= this.prog.length) {
      this.finishProgram('completed');
      return MAX_OPERATIONS;
    }
    this.exec++;
    if (this.exec > EXEC_LIMIT) {
      this.throwError(CC_ERROR.INSTRUCTION_LIMIT);
      this.finishProgram('instruction-limit');
      return MAX_OPERATIONS;
    }

    let cost = 1;
    const op = this.prog[this.ip++];
    switch (op) {
      case '>':
        this.dp++;
        if (this.dp > RAM_SIZE - 1) this.dp = 0;
        break;
      case '<':
        this.dp--;
        if (this.dp < 0) this.dp = RAM_SIZE - 1;
        break;
      case '+':
        this.data[this.dp]++;
        break;
      case '-':
        this.data[this.dp]--;
        break;
      case '.': {
        const code = this.data[this.dp];
        this.textBuffer += Number.isInteger(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : '';
        break;
      }
      case 'T':
        cost = 10;
        this.ax = this.readTemperature(this.sx);
        break;
      case 'A':
      case ',':
        cost = 10;
        this.ax = this.readAggregateVolume(this.sx);
        break;
      case 'V':
        cost = 10;
        this.ax = this.readReagentVolume(this.sx, this.data[this.dp]);
        break;
      case 'N':
        cost = 10;
        this.ax = this.readReagentCount(this.sx);
        break;
      case '[':
        if (this.data[this.dp] === 0) {
          let count = 1;
          while (this.ip < this.prog.length && count > 0) {
            if (this.prog[this.ip] === '[') count++;
            if (this.prog[this.ip] === ']') count--;
            this.ip++;
          }
        }
        break;
      case ']':
        cost = 10;
        if (this.data[this.dp] !== 0) {
          let count = 1;
          this.ip--;
          while (this.ip > 0 && count > 0) {
            this.ip--;
            if (this.prog[this.ip] === '[') count--;
            if (this.prog[this.ip] === ']') count++;
          }
          if (this.ip === 0 && count > 0) {
            // In-game this stalls the machine forever; we halt with an error instead.
            this.throwError(CC_ERROR.UNMATCHED_BRACKET);
            this.finishProgram('unmatched-bracket');
            return MAX_OPERATIONS;
          }
        }
        break;
      case '{':
        this.data[this.dp] = this.sx;
        break;
      case '}':
        this.sx = this.data[this.dp];
        break;
      case '(':
        this.data[this.dp] = this.tx;
        break;
      case ')':
        this.tx = this.data[this.dp];
        break;
      case '^':
        this.data[this.dp] = this.ax;
        break;
      case "'":
        this.ax = this.data[this.dp];
        break;
      case '$': {
        cost = MAX_OPERATIONS;
        const heatTo = T0C - this.tx + this.ax;
        this.heatReagents(this.sx, heatTo);
        break;
      }
      case '@':
        cost = MAX_OPERATIONS;
        this.transferReagents(this.sx, this.tx, this.ax, 0);
        break;
      case '#':
        cost = MAX_OPERATIONS;
        this.transferReagents(this.sx, this.tx, this.ax, this.data[this.dp]);
        break;
      case '*':
        cost = MAX_OPERATIONS;
        this.awaitingReactionTick = true;
        break;
      default:
        break;
    }

    if (this.textBuffer.length > 80) {
      this.textOutput += `${this.textBuffer}\n`;
      this.textBuffer = '';
    }
    if (this.running && this.ip >= this.prog.length && !this.awaitingReactionTick) {
      this.finishProgram('completed');
    }
    return cost;
  }

  finishProgram(reason) {
    this.running = false;
    this.haltReason = reason;
    this.textOutput += this.textBuffer;
    this.textBuffer = '';
    if (this.textOutput) this.say(this.textOutput);
    this.emit({ type: 'status', running: false });
    if (reason === 'completed') this.throwError(CC_ERROR.NOTIFICATION_COMPLETE);
  }

  // --- Executor (reservoir hardware) ---

  validSourceBeaker(slot, errorCode = CC_ERROR.INVALID_CONTAINER_SX) {
    if (slot < 1 || slot > this.maxReservoir) {
      this.throwError(CC_ERROR.INVALID_SX);
      return null;
    }
    const beaker = this.reservoirs[slot];
    if (!beaker) {
      this.throwError(errorCode);
      return null;
    }
    return beaker;
  }

  readTemperature(slot) {
    const beaker = this.validSourceBeaker(slot);
    if (!beaker) return 0;
    return Math.round(beaker.temperature - T0C);
  }

  readAggregateVolume(slot) {
    const beaker = this.validSourceBeaker(slot);
    if (!beaker) return 0;
    return Math.round(beakerTotalVolume(beaker));
  }

  readReagentVolume(slot, index) {
    const beaker = this.validSourceBeaker(slot);
    if (!beaker) return 0;
    if (index < 1 || index > beaker.contents.length) {
      this.throwError(CC_ERROR.INDEX_INVALID);
      return 0;
    }
    return Math.round(beaker.contents[index - 1].volume);
  }

  readReagentCount(slot) {
    const beaker = this.validSourceBeaker(slot);
    if (!beaker) return 0;
    return beaker.contents.length;
  }

  transferReagents(source, target, amount, index) {
    if (source < 1 || source > this.maxReservoir) {
      this.throwError(CC_ERROR.INVALID_SX);
      return;
    }
    if (target < 1 || target > 13 || (target > this.maxReservoir && target < 11)) {
      // Slots between maxReservoir and 11 don't exist (mini variant has 6).
      this.throwError(CC_ERROR.INVALID_TX);
      return;
    }
    const src = this.reservoirs[source];
    if (!src) {
      this.throwError(CC_ERROR.INVALID_CONTAINER_SX);
      return;
    }
    if (target <= this.maxReservoir && !this.reservoirs[target]) {
      this.throwError(CC_ERROR.INVALID_CONTAINER_TX);
      return;
    }
    if (index > 0 && (index < 1 || index > src.contents.length)) {
      this.throwError(CC_ERROR.INDEX_INVALID);
      return;
    }

    this.message('The machine emits a slight humming sound.');
    const srcTotal = beakerTotalVolume(src);

    if (target <= this.maxReservoir) {
      transferContents(src, this.reservoirs[target], amount, index);
      return;
    }
    if (target === 11) {
      if (srcTotal >= 1 && amount > 0) {
        this.message('The machine makes an alarming grinding noise!');
        const pill = createBeaker({ name: 'pill', maxVolume: PILL_CAPACITY, temperature: src.temperature });
        transferContents(src, pill, amount, index);
        this.artifacts.push({ kind: 'pill', contents: pill.contents, temperature: pill.temperature });
        this.emit({ type: 'eject', kind: 'pill', contents: pill.contents });
        this.message('The machine ejects a pill.');
      } else {
        this.message("The machine doesn't have enough reagents to make a pill.");
      }
      return;
    }
    if (target === 12) {
      if (srcTotal >= 1 && amount > 0) {
        const vial = createBeaker({ name: 'vial', maxVolume: VIAL_CAPACITY, temperature: src.temperature });
        transferContents(src, vial, amount, index);
        this.artifacts.push({ kind: 'vial', contents: vial.contents, temperature: vial.temperature });
        this.emit({ type: 'eject', kind: 'vial', contents: vial.contents });
        this.message('The machine ejects a vial of some unknown substance.');
      }
      return;
    }
    if (target === 13) {
      if (srcTotal > 0) {
        const tank = createBeaker({ name: 'floor', maxVolume: EJECTION_TANK_CAPACITY, temperature: src.temperature });
        transferContents(src, tank, amount, index);
        this.artifacts.push({ kind: 'splash', contents: tank.contents, temperature: tank.temperature });
        this.emit({ type: 'eject', kind: 'splash', contents: tank.contents });
        this.message('Something drips out the side of the machine.');
      }
    }
  }

  heatReagents(slot, targetTemp) {
    if (slot < 1 || slot > this.maxReservoir) {
      this.throwError(CC_ERROR.INVALID_SX);
      return;
    }
    const beaker = this.reservoirs[slot];
    if (!beaker) {
      this.throwError(CC_ERROR.INVALID_CONTAINER_SX);
      return;
    }
    if (targetTemp < 1 || targetTemp > 9000) {
      this.throwError(CC_ERROR.INVALID_TEMPERATURE);
      return;
    }

    if (!this.isHeating) {
      this.message('The machine clicks.'); // heating relay on
      this.isHeating = true;
    }

    const difference = targetTemp - beaker.temperature;
    let stillHeating = true;
    if (difference >= 0) {
      beaker.temperature += Math.min(Math.ceil(difference), HEAT_STEP);
    } else {
      beaker.temperature = Math.max(1, beaker.temperature + Math.max(Math.floor(difference), -HEAT_STEP));
    }
    if (Math.abs(difference) <= HEAT_STEP) stillHeating = false;

    if (!stillHeating) {
      this.isHeating = false;
      this.message('The machine clicks.'); // heating relay off
    } else {
      this.ip--; // repeat the heat instruction next tick until target reached
    }
  }
}

/**
 * Convenience one-shot runner for tests and future compiler verification.
 *
 * setup: {
 *   machine: 'stationary' | 'mini',
 *   reservoirs: { [slot]: { name?, maxVolume?, temperature?, contents: [{id, volume}] } },
 *   maxTicks?,
 * }
 */
export function runChemfuck(source, setup = {}) {
  const machine = MACHINE_TYPES[setup.machine ?? 'stationary'];
  const vm = new ChemfuckVM({ maxReservoir: machine.maxReservoir, onReactionTick: setup.onReactionTick });
  for (const [slot, spec] of Object.entries(setup.reservoirs ?? {})) {
    vm.setReservoir(Number(slot), createBeaker(spec));
  }
  vm.loadProgram(source);
  vm.start();
  return vm.run(setup.maxTicks ?? 100000);
}
