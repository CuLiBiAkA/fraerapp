const loginScreen = document.querySelector("#login-screen");
const sceneScreen = document.querySelector("#scene-screen");
const loginForm = document.querySelector("#login-form");
const usernameInput = document.querySelector("#username");
const sceneImage = document.querySelector("#scene-image");
const sceneTitle = document.querySelector("#scene-title");
const sceneText = document.querySelector("#scene-text");
const choices = document.querySelector("#choices");
const status = document.querySelector("#status");
const playerName = document.querySelector("#player-name");
const sceneNode = document.querySelector("#scene-node");
const resetButton = document.querySelector("#reset");
const logoutButton = document.querySelector("#logout");
const soundToggle = document.querySelector("#sound-toggle");

const storage = {
  get playerId() {
    return localStorage.getItem("fraerapp.playerId");
  },
  setSession(player) {
    localStorage.setItem("fraerapp.playerId", player.playerId);
    localStorage.setItem("fraerapp.username", player.username);
  },
  clear() {
    localStorage.removeItem("fraerapp.playerId");
    localStorage.removeItem("fraerapp.username");
  },
};

let sound = null;

const api = {
  async login(username) {
    return request("/api/auth/login", {
      method: "POST",
      body: { username },
    });
  },
  async state() {
    return request("/api/game/state");
  },
  async choice(choiceId) {
    return request("/api/game/choice", {
      method: "POST",
      body: { choiceId },
    });
  },
  async reset() {
    return request("/api/game/reset", { method: "POST" });
  },
};

async function request(path, options = {}) {
  const headers = { Accept: "application/json" };
  if (options.body) {
    headers["Content-Type"] = "application/json";
  }
  if (storage.playerId) {
    headers["X-Player-Id"] = storage.playerId;
  }

  const response = await fetch(path, {
    method: options.method || "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return response.json();
}

function showLogin() {
  loginScreen.classList.remove("hidden");
  sceneScreen.classList.add("hidden");
  usernameInput.focus();
}

function showGame() {
  loginScreen.classList.add("hidden");
  sceneScreen.classList.remove("hidden");
}

function setStatus(message) {
  status.textContent = message;
}

function render(state) {
  const scene = state.scene;
  showGame();
  playerName.textContent = state.username;
  sceneNode.textContent = scene.id;
  sceneTitle.textContent = scene.title;
  sceneText.textContent = scene.text;
  sceneImage.src = scene.imageUrl;
  sceneImage.alt = scene.title;
  choices.replaceChildren();

  if (scene.choices.length === 0) {
    const end = document.createElement("p");
    end.className = "status";
    end.textContent = "\u041a\u043e\u043d\u0435\u0446 \u0432\u0435\u0442\u043a\u0438. \u041c\u043e\u0436\u043d\u043e \u0441\u0431\u0440\u043e\u0441\u0438\u0442\u044c \u043f\u0440\u043e\u0433\u0440\u0435\u0441\u0441 \u0438 \u043f\u0440\u043e\u0439\u0442\u0438 \u0438\u043d\u0430\u0447\u0435.";
    choices.append(end);
  }

  for (const choice of scene.choices) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = choice.label;
    button.addEventListener("click", async () => {
      await withBusy(button, async () => {
        ensureSound();
        const nextState = await api.choice(choice.id);
        render(nextState);
      });
    });
    choices.append(button);
  }

  setStatus("\u0425\u043e\u0434 \u0441\u043e\u0445\u0440\u0430\u043d\u0435\u043d");
}

async function loadState() {
  if (!storage.playerId) {
    showLogin();
    return;
  }

  try {
    setStatus("\u0417\u0430\u0433\u0440\u0443\u0437\u043a\u0430...");
    render(await api.state());
  } catch (error) {
    storage.clear();
    showLogin();
  }
}

async function withBusy(button, action) {
  try {
    button.disabled = true;
    setStatus("\u0421\u0446\u0435\u043d\u0430 \u043c\u0435\u043d\u044f\u0435\u0442\u0441\u044f...");
    await action();
  } catch (error) {
    setStatus(`\u041e\u0448\u0438\u0431\u043a\u0430: ${error.message}`);
  } finally {
    button.disabled = false;
  }
}

function ensureSound() {
  if (sound) {
    sound.start();
  }
}

function createSound() {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) {
    return null;
  }

  let context;
  let gain;
  let oscillators = [];
  let enabled = false;

  return {
    async start() {
      if (enabled) {
        return;
      }

      if (!context) {
        context = new AudioContext();
      }
      await context.resume();
      gain = context.createGain();
      gain.gain.value = 0.025;
      gain.connect(context.destination);
      oscillators = [146.83, 220, 293.66].map((frequency) => {
        const osc = context.createOscillator();
        osc.type = "sine";
        osc.frequency.value = frequency;
        osc.connect(gain);
        osc.start();
        return osc;
      });
      enabled = true;
      soundToggle.textContent = "\u0417\u0432\u0443\u043a: \u0432\u043a\u043b\u044e\u0447\u0435\u043d";
    },
    stop() {
      for (const osc of oscillators) {
        osc.stop();
      }
      oscillators = [];
      enabled = false;
      soundToggle.textContent = "\u0417\u0432\u0443\u043a: \u0432\u044b\u043a\u043b\u044e\u0447\u0435\u043d";
    },
    toggle() {
      if (enabled) {
        this.stop();
      } else {
        this.start();
      }
    },
  };
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const username = usernameInput.value.trim();
  if (!username) {
    return;
  }

  try {
    const player = await api.login(username);
    storage.setSession(player);
    ensureSound();
    render(await api.state());
  } catch (error) {
    alert(`\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0432\u043e\u0439\u0442\u0438: ${error.message}`);
  }
});

resetButton.addEventListener("click", async () => {
  setStatus("\u0421\u0431\u0440\u0430\u0441\u044b\u0432\u0430\u0435\u043c \u043c\u0430\u0440\u0448\u0440\u0443\u0442...");
  render(await api.reset());
});

logoutButton.addEventListener("click", () => {
  storage.clear();
  showLogin();
});

soundToggle.addEventListener("click", () => {
  if (!sound) {
    sound = createSound();
  }
  if (!sound) {
    setStatus("\u0411\u0440\u0430\u0443\u0437\u0435\u0440 \u043d\u0435 \u043f\u043e\u0434\u0434\u0435\u0440\u0436\u0438\u0432\u0430\u0435\u0442 Web Audio");
    return;
  }
  sound.toggle();
});

sound = createSound();
loadState();
