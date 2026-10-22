/* Direction input for the PS1 player's digital stick. */
(function (root) {
  const controllers = new Map();
  function create(send) {
    let active = false;
    let sector = null;
    const values = [0, 0, 0, 0];
    function emit(next) {
      next.forEach((value, i) => {
        if (values[i] !== value) send(i, value);
        values[i] = value;
      });
    }
    function reset() {
      active = false;
      sector = null;
      emit([0, 0, 0, 0]);
    }
    return {
      reset,
      move(degrees, distance) {
        // Separate start/stop thresholds prevent chatter at the centre edge.
        if (!Number.isFinite(degrees) || !Number.isFinite(distance) || distance < (active ? 16 : 24)) {
          reset();
          return;
        }
        active = true;
        const angle = ((degrees % 360) + 360) % 360;
        const difference = sector === null ? 180 : Math.abs(((angle - sector * 45 + 540) % 360) - 180);
        // Keep the current direction through small slips across a sector edge.
        if (difference > 30) sector = Math.round(angle / 45) % 8;
        const directions = [
          [0, 0, 0, 1], [1, 0, 0, 1], [1, 0, 0, 0], [1, 0, 1, 0],
          [0, 0, 1, 0], [0, 1, 1, 0], [0, 1, 0, 0], [0, 1, 0, 1]
        ];
        emit(directions[sector]);
      }
    };
  }
  root.PS1Touch = {
    create,
    handle(manager, zone, info) {
      let controller = controllers.get(zone);
      if (!controller) {
        controller = create((i, value) => manager.simulateInput(0, zone.inputValues[i], value));
        controllers.set(zone, controller);
      }
      if (info) controller.move(info.angle.degree, info.distance);
      else controller.reset();
    },
    reset() { controllers.forEach(controller => controller.reset()); }
  };
  if (root.addEventListener) {
    root.addEventListener('blur', () => root.PS1Touch.reset());
    root.addEventListener('pagehide', () => root.PS1Touch.reset());
    root.document.addEventListener('visibilitychange', () => {
      if (root.document.hidden) root.PS1Touch.reset();
    });
  }
})(typeof window === 'undefined' ? globalThis : window);
