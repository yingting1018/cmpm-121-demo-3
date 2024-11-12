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

interface Coordinates {
  lat: number;
  lng: number;
}
interface Cache {
  location: Coordinates;
  coins: number;
}

class Game {
  playerLocation: Coordinates;
  caches: Cache[] = [];
  gridSize: number = 0.0001;
  cacheProbability: number = 0.1;
  map: L.Map;
  playerPoints: number = 0; // Track player points

  constructor() {
    this.playerLocation = { lat: 36.9895, lng: -122.0628 };
    this.map = L.map("map").setView([
      this.playerLocation.lat,
      this.playerLocation.lng,
    ], 16);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
    }).addTo(this.map);
    this.initializeCaches();
    this.renderMap();
  }

  initializeCaches() {
    const maxDistance = 8;
    for (let dx = -maxDistance; dx <= maxDistance; dx++) {
      for (let dy = -maxDistance; dy <= maxDistance; dy++) {
        if (Math.random() < this.cacheProbability) {
          const cacheLocation: Coordinates = {
            lat: this.playerLocation.lat + dx * this.gridSize,
            lng: this.playerLocation.lng + dy * this.gridSize,
          };
          const coins = this.generateCoins();
          this.caches.push({ location: cacheLocation, coins });
        }
      }
    }
  }

  generateCoins(): number {
    return Math.floor(Math.random() * 10) + 1;
  }

  renderMap() {
    this.map.eachLayer((layer: L.Layer) => {
      if (
        "options" in layer &&
        (layer as L.TileLayer).options?.attribution !== undefined
      ) return;
      this.map.removeLayer(layer);
    });

    // Add player marker
    L.marker([this.playerLocation.lat, this.playerLocation.lng])
      .addTo(this.map)
      .bindPopup(
        `Player Location<br>Lat: ${this.playerLocation.lat}<br>Lng: ${this.playerLocation.lng}`,
      )
      .openPopup();

    // Add cache markers with popups
    this.caches.forEach((cache, index) => {
      const marker = L.marker([cache.location.lat, cache.location.lng]).addTo(
        this.map,
      );
      marker.bindPopup(`
            <div>
                <h3>Cache #${index + 1}</h3>
                <p>Coins: <span id="coins">${cache.coins}</span></p>
                <button class="collect-btn" data-index="${index}">Collect</button>
                <button class="deposit-btn" data-index="${index}">Deposit</button>
            </div>
        `).on("popupopen", () => {
        // Add event listeners when the popup opens
        const collectBtn = document.querySelector(
          `.collect-btn[data-index="${index}"]`,
        ) as HTMLButtonElement;
        const depositBtn = document.querySelector(
          `.deposit-btn[data-index="${index}"]`,
        ) as HTMLButtonElement;

        if (collectBtn) {
          collectBtn.addEventListener("click", () => this.collectCoins(index));
        }
        if (depositBtn) {
          depositBtn.addEventListener("click", () => this.depositCoins(index));
        }
      });
    });

    // Update player points display
    const statusPanel = document.querySelector<HTMLDivElement>("#statusPanel")!;
    statusPanel.innerHTML = `Points: ${this.playerPoints}`;
  }

  collectCoins(cacheIndex: number) {
    const cache = this.caches[cacheIndex];
    if (cache.coins > 0) {
      // Collect coins from the cache
      const collectedCoins = cache.coins;
      alert(`Collected ${collectedCoins} coins from cache #${cacheIndex + 1}.`);
      this.playerPoints += collectedCoins; // Add to player points
      cache.coins = 0; // Empty the cache
      this.renderMap(); // Re-render the map to update the UI
    }
  }

  depositCoins(cacheIndex: number) {
    const cache = this.caches[cacheIndex];
    const coinsToDeposit = 5;
    cache.coins += coinsToDeposit; // Add coins to the cache
    alert(`Deposited ${coinsToDeposit} coins to cache #${cacheIndex + 1}.`);
    this.renderMap(); // Re-render the map to update the UI
  }
}

// Initialize and assign the game instance to globalThis
const game = new Game();
(globalThis as typeof globalThis & { game: Game }).game = game;
