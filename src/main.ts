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
interface GridCoordinates {
  i: number;
  j: number;
}
interface Coin {
  id: string;
  cacheLocation: GridCoordinates;
}
interface Cache {
  location: GridCoordinates;
  coins: Coin[];
}

class Game {
  playerLocation: Coordinates;
  caches: Cache[] = [];
  gridSize: number = 0.0001;
  cacheProbability: number = 0.1;
  map: L.Map;
  playerPoints: number = 0;

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
  convertToGridCoordinates({ lat, lng }: Coordinates): GridCoordinates {
    const i = Math.floor(lat / this.gridSize);
    const j = Math.floor(lng / this.gridSize);
    return { i, j };
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
          const gridCoords = this.convertToGridCoordinates(cacheLocation);
          const coins = this.generateCoins(gridCoords);
          this.caches.push({ location: gridCoords, coins });
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
      const coinList = cache.coins.map((coin) => `<li>${coin.id}</li>`).join(
        "<br>",
      );
      const marker = L.marker([
        cache.location.i * this.gridSize,
        cache.location.j * this.gridSize,
      ]).addTo(this.map);
      marker.bindPopup(`
            <div>
                <h3>Cache ${cacheLat}:${cacheLng}</h3>
                <p>Coins:<ul>${coinList}</ul></p>
                <button class="collect-btn" data-index="${cacheIndex}">Collect</button>
                <button class="deposit-btn" data-index="${cacheIndex}">Deposit</button>
            </div>
        `).on("popupopen", () => {
        const collectBtn = document.querySelector(
          `.collect-btn[data-index="${cacheIndex}"]`,
        ) as HTMLButtonElement;
        const depositBtn = document.querySelector(
          `.deposit-btn[data-index="${cacheIndex}"]`,
        ) as HTMLButtonElement;

        if (collectBtn) {
          collectBtn.addEventListener(
            "click",
            () => this.collectCoins(cacheIndex),
          );
        }
        if (depositBtn) {
          depositBtn.addEventListener(
            "click",
            () => this.depositCoins(cacheIndex),
          );
        }
      });
    });

    const statusPanel = document.querySelector<HTMLDivElement>("#statusPanel")!;
    statusPanel.innerHTML = `Points: ${this.playerPoints}`;
  }

  collectCoins(cacheIndex: number) {
    const cache = this.caches[cacheIndex];
    if (cache.coins.length > 0) {
      const collectedCoins = cache.coins.length;
      alert(`Collected ${collectedCoins} coins from cache #${cacheIndex + 1}.`);
      this.playerPoints += collectedCoins;
      cache.coins = [];
      this.renderMap();
    }
  }

  depositCoins(cacheIndex: number) {
    const cache = this.caches[cacheIndex];
    const coinsToDeposit = 5;
    for (let i = 0; i < coinsToDeposit; i++) {
      cache.coins.push({
        id: `${cache.location.i}_${cache.location.j}_${cache.coins.length}`,
        cacheLocation: cache.location,
      });
    }
    alert(`Deposited ${coinsToDeposit} coins to cache #${cacheIndex + 1}.`);
    this.renderMap();
  }
}

const game = new Game();
(globalThis as typeof globalThis & { game: Game }).game = game;
