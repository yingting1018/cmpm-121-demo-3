import L from "leaflet";
import "./leafletWorkaround.ts";
import "./style.css";
import "leaflet/dist/leaflet.css";

declare global {
  interface GlobalThis {
    game: Game;
  }
}

const app = document.querySelector<HTMLDivElement>("#app")!;
const gameName = "Geocoin Carrier";
document.title = gameName;
const header = document.createElement("h1");
header.innerHTML = gameName;
app.append(header);
const movement = document.createElement("div");
movement.id = "movement";
movement.innerHTML = `
<button id="move-up">⬆️</button>
  <button id="move-left">⬅️</button>
  <button id="move-down">⬇️</button>
  <button id="move-right">➡️</button>
`;
app.appendChild(movement);
const geoLocation = document.createElement("button");
geoLocation.id = "geo-location";
geoLocation.textContent = "🌐";
app.appendChild(geoLocation);
const resetButton = document.createElement("button");
resetButton.id = "reset-game";
resetButton.textContent = "🚮";
app.appendChild(resetButton);

interface Coordinates {
  lat: number;
  lng: number;
}
interface GridCoordinates {
  i: number;
  j: number;
}
interface Coin {
  id: string;
  cacheLocation: GridCoordinates;
}
interface Cache {
  id: string;
  location: GridCoordinates;
  coins: Coin[];
}
interface Momento<T> {
  toMomento(): T;
  fromMomento(momento: T): Cache;
}
class cacheMomento implements Momento<string> {
  private _cacheData: string;
  constructor(cache: Cache) {
    this._cacheData = JSON.stringify(cache);
  }
  toMomento(): string {
    return this._cacheData;
  }
  fromMomento(momento: string): Cache {
    return JSON.parse(momento) as Cache;
  }
}
class Game {
  playerLocation: Coordinates;
  caches: Cache[] = [];
  cacheStates: Map<string, string> = new Map();
  gridSize: number = 0.0001;
  cacheProbability: number = 0.1;
  map: L.Map;
  playerPoints: number = 0;
  maxCacheDistance: number = 5;
  collectedCoins: Coin[] = [];
  geoId: number | null = null;
  movementHistory: Coordinates[] = [];
  movementPolyline: L.Polyline | null = null;

  constructor() {
    this.loadGame();
    this.playerLocation = { lat: 36.9895, lng: -122.0628 };
    if (!this.map) {
      const mapElement = document.querySelector<HTMLDivElement>("#map");
      if (mapElement) {
        this.map = L.map(mapElement).setView([
          this.playerLocation.lat,
          this.playerLocation.lng,
        ], 18);
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 20,
        }).addTo(this.map);
      }
    } else {
      this.map.setView([this.playerLocation.lat, this.playerLocation.lng], 18);
    }
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 20,
    }).addTo(this.map);
    this.initializeCaches();
    this.renderMap();
    this.setupMovementControls();
    this.renderInventory();
    this.setupGeoLocation();
    this.movementPolyline = L.polyline([], { color: "blue" }).addTo(this.map);
  }

  convertToGridCoordinates({ lat, lng }: Coordinates): GridCoordinates {
    const i = Math.floor(lat / this.gridSize);
    const j = Math.floor(lng / this.gridSize);
    return { i, j };
  }

  initializeCaches() {
    const { lat, lng } = this.playerLocation;
    const maxDistance = this.maxCacheDistance;
    this.caches = [];
    for (let dx = -maxDistance; dx <= maxDistance; dx++) {
      for (let dy = -maxDistance; dy <= maxDistance; dy++) {
        const cacheLocation: Coordinates = {
          lat: lat + dx * this.gridSize,
          lng: lng + dy * this.gridSize,
        };
        const gridCoords = this.convertToGridCoordinates(cacheLocation);
        const cacheId = `${gridCoords.i}:${gridCoords.j}`;
        if (this.cacheStates.has(cacheId)) {
          const momento = this.cacheStates.get(cacheId)!;
          const restoredCache = new cacheMomento({} as Cache).fromMomento(
            momento,
          );
          this.caches.push(restoredCache);
        } else if (Math.random() < this.cacheProbability) {
          const coins = this.generateCoins(gridCoords);
          const newCache = { id: cacheId, location: gridCoords, coins };
          this.caches.push(newCache);
          const momento = new cacheMomento(newCache).toMomento();
          this.cacheStates.set(cacheId, momento);
        }
      }
    }
  }

  generateCoins(cacheLocation: GridCoordinates): Coin[] {
    const numberOfCoins = Math.floor(Math.random() * 10) + 1;
    return Array.from({ length: numberOfCoins }, (_, serial) => ({
      id: `${cacheLocation.i}:${cacheLocation.j}#${serial}`,
      cacheLocation,
    }));
  }
  renderMap() {
    const statusPanel =
      document.querySelector<HTMLDivElement>("#statusPanel") ||
      document.createElement("div");
    statusPanel.id = "statusPanel";
    app.appendChild(statusPanel);

    this.map.eachLayer((layer: L.Layer) => {
      if (
        "options" in layer &&
        (layer as L.TileLayer).options?.attribution !== undefined
      ) return;
      this.map.removeLayer(layer);
    });

    L.marker([this.playerLocation.lat, this.playerLocation.lng])
      .addTo(this.map)
      .bindPopup(
        `Player Location<br>Lat: ${this.playerLocation.lat}<br>Lng: ${this.playerLocation.lng}`,
      )
      .openPopup();

    this.caches.forEach((cache, cacheIndex) => {
      const cacheLat = (cache.location.i * this.gridSize).toFixed(6);
      const cacheLng = (cache.location.j * this.gridSize).toFixed(6);
      const coinList = cache.coins.map((coin) => `
  <li>
    ${coin.id} 
    <button class="collect-coin-btn" data-cache-id="${cache.id}" data-coin-id="${coin.id}">Collect</button>
  </li>`).join("");

      const marker = L.marker([
        cache.location.i * this.gridSize,
        cache.location.j * this.gridSize,
      ]).addTo(this.map);

      marker.bindPopup(`
        <div>
            <h3>Cache ${cacheLat}:${cacheLng}</h3>
            <p>Inventory:<ul>${coinList}</ul></p>
            <button class="deposit-coins-btn" data-cache-index="${cacheIndex}">Deposit</button>
        </div>
      `).on("popupopen", () => {
        document.querySelectorAll(".collect-coin-btn").forEach((btn) => {
          btn.addEventListener("click", (event) => {
            const target = event.target as HTMLButtonElement;
            const cacheId = target.dataset.cacheId!;
            const coinId = target.dataset.coinId!;
            this.collectCoin(cacheId, coinId);
          });
        });
        document.querySelectorAll(".deposit-coins-btn").forEach((btn) => {
          btn.addEventListener("click", (event) => {
            const target = event.target as HTMLButtonElement;
            const cacheIndex = parseInt(target.dataset.cacheIndex!, 10);
            this.depositCoins(cacheIndex);
          });
        });
      });
    });
  }
  setupMovementControls() {
    const directions: { [key: string]: "up" | "down" | "left" | "right" } = {
      "move-up": "up",
      "move-down": "down",
      "move-left": "left",
      "move-right": "right",
    };

    Object.keys(directions).forEach((buttonId) => {
      const button = document.querySelector(`#${buttonId}`);
      if (button) {
        console.log(`Button ${buttonId} found!`);
        const direction = directions[buttonId as keyof typeof directions];
        button.addEventListener("click", () => {
          console.log(`Button ${buttonId} clicked, moving player ${direction}`);
          this.movePlayer(direction);
        });
      } else {
        console.warn(`Button ${buttonId} not found`);
      }
    });
  }

  movePlayer(direction: "up" | "down" | "left" | "right") {
    const previousLocation = { ...this.playerLocation };
    switch (direction) {
      case "up":
        this.playerLocation.lat += this.gridSize;
        break;
      case "down":
        this.playerLocation.lat -= this.gridSize;
        break;
      case "left":
        this.playerLocation.lng -= this.gridSize;
        break;
      case "right":
        this.playerLocation.lng += this.gridSize;
        break;
    }
    this.movementHistory.push(previousLocation);
    if (this.movementPolyline) {
      this.movementPolyline.setLatLngs(
        this.movementHistory.map((coord) => [coord.lat, coord.lng]),
      );
    }
    this.initializeCaches();
    this.map.setView([this.playerLocation.lat, this.playerLocation.lng]);
    this.renderMap();
    this.triggerAutoSave();
  }
  renderInventory() {
    let inventory = document.querySelector<HTMLDivElement>("#inventory");
    if (!inventory) {
      inventory = document.createElement("div");
      inventory.id = "inventory";
      inventory.innerHTML = `
        <h2>Inventory:</h2>
        <ul id="coin-list"></ul>
      `;
      app.append(inventory);
    }
    const coinList = document.querySelector<HTMLUListElement>("#coin-list")!;
    coinList.innerHTML = this.collectedCoins
      .map((coin) => `
        <li class="coin-item" data-cache-i="${coin.cacheLocation.i}" data-cache-j="${coin.cacheLocation.j}">
          ${coin.id}
        </li>
      `)
      .join("");
    document.querySelectorAll<HTMLLIElement>(".coin-item").forEach(
      (coinItem) => {
        coinItem.addEventListener("click", (event) => {
          const target = event.currentTarget as HTMLLIElement;
          const cacheI = parseInt(target.dataset.cacheI!, 10);
          const cacheJ = parseInt(target.dataset.cacheJ!, 10);
          const cacheLat = cacheI * this.gridSize;
          const cacheLng = cacheJ * this.gridSize;
          this.map.setView([cacheLat, cacheLng], 18);
          alert(
            `Centered map on cache at (${cacheLat.toFixed(6)}, ${
              cacheLng.toFixed(6)
            })`,
          );
        });
      },
    );
  }

  collectCoin(cacheId: string, coinId: string) {
    const cache = this.caches.find((cache) => cache.id === cacheId);
    if (!cache) {
      alert(`Cache with ID ${cacheId} not found.`);
      return;
    }

    const coinIndex = cache.coins.findIndex((coin) => coin.id === coinId);
    if (coinIndex !== -1) {
      const collectedCoin = cache.coins.splice(coinIndex, 1)[0];
      this.playerPoints += 1;
      this.collectedCoins.push(collectedCoin);
      alert(`Collected coin ${coinId}.`);
      const momento = new cacheMomento(cache).toMomento();
      this.cacheStates.set(cacheId, momento);
      this.renderInventory();
      this.renderMap();
      this.triggerAutoSave();
    }
  }

  depositCoins(cacheIndex: number) {
    const cache = this.caches[cacheIndex];
    if (!cache) {
      alert(`Cache with index ${cacheIndex} not found.`);
      return;
    }

    const coinsToDeposit = Math.min(this.collectedCoins.length, 5);
    const coinsBeingDeposited = this.collectedCoins.splice(0, coinsToDeposit);
    coinsBeingDeposited.forEach((coin) => {
      cache.coins.push({
        ...coin,
        cacheLocation: cache.location,
      });
    });
    alert(`Deposited ${coinsToDeposit} coins to cache #${cacheIndex + 1}.`);
    const momento = new cacheMomento(cache).toMomento();
    this.cacheStates.set(cache.id, momento);
    this.renderInventory();
    this.renderMap();
    this.triggerAutoSave();
  }

  setupGeoLocation() {
    const geoToggle = document.querySelector<HTMLButtonElement>(
      "#geo-location",
    )!;
    geoToggle.addEventListener("click", () => {
      if (this.geoId === null) {
        this.enableGeolocation();
      }
    });
  }
  enableGeolocation() {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser.");
      return;
    }
    this.geoId = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        this.playerLocation.lat = latitude;
        this.playerLocation.lng = longitude;
        this.initializeCaches();
        this.map.setView([latitude, longitude]);
        this.renderMap();
        this.triggerAutoSave();
      },
      (error) => {
        alert(`Geolocation error: ${error.message}`);
      },
      { enableHighAccuracy: true },
    );
  }
  saveGame() {
    const gameState = {
      playerLocation: this.playerLocation,
      cacheStates: Array.from(this.cacheStates.entries()),
      playerPoints: this.playerPoints,
      collectedCoins: this.collectedCoins,
    };
    localStorage.setItem("geocoin-carrier-save", JSON.stringify(gameState));
  }
  loadGame() {
    const savedState = localStorage.getItem("geocoin-carrier-save");
    if (!savedState) {
      console.warn("No saved game found.");
      return;
    }
    const gameState = JSON.parse(savedState);

    if (!this.map) {
      const mapElement = document.querySelector<HTMLDivElement>("#map");
      if (mapElement) {
        this.map = L.map(mapElement).setView([
          gameState.playerLocation.lat,
          gameState.playerLocation.lng,
        ], 18);
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 20,
        }).addTo(this.map);
      }
    }
    if (
      gameState.playerLocation &&
      typeof gameState.playerLocation.lat === "number" &&
      typeof gameState.playerLocation.lng === "number" &&
      Array.isArray(gameState.cacheStates) &&
      gameState.cacheStates.every(([key, value]: [string, string]) =>
        typeof key === "string" && typeof value === "string"
      ) &&
      Array.isArray(gameState.collectedCoins)
    ) {
      this.playerLocation = gameState.playerLocation;
      this.cacheStates = new Map(gameState.cacheStates);
      this.playerPoints = gameState.playerPoints || 0;
      this.collectedCoins = gameState.collectedCoins || [];
      this.initializeCaches();
      this.map.setView([this.playerLocation.lat, this.playerLocation.lng]);
      this.renderMap();
      this.renderInventory();
    }
  }
  triggerAutoSave() {
    this.saveGame();
  }
  resetGame() {
    this.playerLocation = { lat: 36.9895, lng: -122.0628 };
    this.cacheStates.clear();
    this.initializeCaches();
    this.collectedCoins = [];
    this.playerPoints = 0;
    this.movementHistory = [];
    if (this.movementPolyline) {
      this.movementPolyline.setLatLngs([]);
    }
    if (this.geoId !== null) {
      navigator.geolocation.clearWatch(this.geoId);
      this.geoId = null;
    }
    this.renderInventory();
    this.renderMap();
    this.map.setView([this.playerLocation.lat, this.playerLocation.lng], 18);
    localStorage.removeItem("geocoin-carrier-save");
    alert("Game has been reset!");
  }
}
document.addEventListener("DOMContentLoaded", () => {
  resetButton.addEventListener("click", () => {
    const confirmation = prompt(
      "Are you sure you want to erase your game state? Type 'YES' to confirm.",
    );
    if (confirmation === "Yes") {
      game.resetGame();
    } else {
      alert("Reset canceled.");
    }
  });
  const game = new Game();
  (globalThis as typeof globalThis & { game: Game }).game = game;
});
