const config = {
  defaultLocation: [-8.0476, -34.877], // Recife como localização padrão
  defaultZoom: 13,
};

// Variáveis globais
let map;
let markers = [];
let userPosition = null;

// Inicialização do mapa
function initMap() {
  map = L.map("mapa").setView(config.defaultLocation, config.defaultZoom);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(map);

  // Tenta geolocalização
  locateUser();
}

// Geolocalização do usuário
function locateUser() {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        userPosition = [position.coords.latitude, position.coords.longitude];
        map.setView(userPosition, 15);
        L.marker(userPosition)
          .addTo(map)
          .bindPopup("Sua localização")
          .openPopup();
        searchPlaces();
      },
      (error) => {
        console.warn("Erro na geolocalização:", error);
        searchPlaces();
      }
    );
  } else {
    searchPlaces();
  }
}

// Busca locais no OpenStreetMap
async function searchPlaces() {
  clearMarkers();
  showLoading();

  const tipo = document.getElementById("tipoLocal").value;
  const raio = document.getElementById("raioBusca").value;
  const center = map.getCenter();

  try {
    const places = await fetchPlacesFromOverpass(
      tipo,
      raio,
      center.lat,
      center.lng
    );
    displayResults(places);
    addMarkers(places);
  } catch (error) {
    console.error("Erro na busca:", error);
    document.getElementById("feedResultados").innerHTML = `
      <div class="alert alert-danger">
        Erro ao buscar locais: ${error.message}
      </div>`;
  }
}

// Consulta a Overpass API
async function fetchPlacesFromOverpass(tipo, raio, lat, lng) {
  const query = buildOverpassQuery(tipo, raio, lat, lng);
  const response = await fetch(
    `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`
  );

  if (!response.ok) {
    throw new Error(`Erro HTTP: ${response.status}`);
  }

  return await response.json();
}

// Constrói a query para Overpass QL
function buildOverpassQuery(tipo, raio, lat, lng) {
  const filters = {
    pet: '["shop"="pet"]',
    veterinary: '["amenity"="veterinary"]',
    dog_park: '["leisure"="dog_park"]',
  };

  return `
    [out:json];
    (
      node${filters[tipo]}(around:${raio},${lat},${lng});
      way${filters[tipo]}(around:${raio},${lat},${lng});
      relation${filters[tipo]}(around:${raio},${lat},${lng});
    );
    out center;
  `;
}

// Exibe resultados no feed
function displayResults(places) {
  const feed = document.getElementById("feedResultados");

  if (!places.elements || places.elements.length === 0) {
    feed.innerHTML = `
      <div class="alert alert-warning">
        Nenhum local encontrado. Tente ampliar o raio de busca.
      </div>`;
    return;
  }

  feed.innerHTML = places.elements
    .map((place) => {
      const name = place.tags?.name || "Local sem nome";
      const address = place.tags?.["addr:street"] || "Endereço não disponível";
      const type = getPlaceType(place.tags);

      return `
      <div class="place-card">
        <h5>${name}</h5>
        <p class="text-muted">${address}</p>
        <div class="d-flex justify-content-between align-items-center">
          <span class="badge bg-primary">${type}</span>
          <button class="btn btn-sm btn-outline-primary view-on-map" 
                  data-lat="${getPlaceLat(place)}" 
                  data-lng="${getPlaceLng(place)}">
            Ver no mapa
          </button>
        </div>
      </div>
    `;
    })
    .join("");

  // Adiciona eventos aos botões
  document.querySelectorAll(".view-on-map").forEach((btn) => {
    btn.addEventListener("click", () => {
      const lat = parseFloat(btn.dataset.lat);
      const lng = parseFloat(btn.dataset.lng);
      map.setView([lat, lng], 17);
    });
  });
}

// Helper: Obtém coordenadas do local
function getPlaceLat(place) {
  return place.lat || place.center?.lat;
}

function getPlaceLng(place) {
  return place.lon || place.center?.lon;
}

// Helper: Traduz tipos de lugares
function getPlaceType(tags) {
  if (tags?.shop === "pet") return "Pet Shop";
  if (tags?.amenity === "veterinary") return "Veterinário";
  if (tags?.leisure === "dog_park") return "Parque para Cães";
  return "Local Pet-Friendly";
}

// Adiciona marcadores no mapa
function addMarkers(places) {
  places.elements.forEach((place) => {
    const lat = getPlaceLat(place);
    const lng = getPlaceLng(place);

    if (lat && lng) {
      const marker = L.marker([lat, lng]).addTo(map);
      const name = place.tags?.name || "Local sem nome";
      marker.bindPopup(`<b>${name}</b><br>${getPlaceType(place.tags)}`);
      markers.push(marker);
    }
  });
}

// Limpa marcadores antigos
function clearMarkers() {
  markers.forEach((marker) => map.removeLayer(marker));
  markers = [];
}

// Mostra loading
function showLoading() {
  document.getElementById("feedResultados").innerHTML = `
    <div class="text-center py-4">
      <div class="spinner-border text-primary" role="status">
        <span class="visually-hidden">Carregando...</span>
      </div>
      <p class="mt-2">Buscando locais...</p>
    </div>`;
}

// Inicialização
document.addEventListener("DOMContentLoaded", () => {
  initMap();
  document.getElementById("btnBuscar").addEventListener("click", searchPlaces);
});
