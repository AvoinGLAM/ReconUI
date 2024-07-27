Vue.component('map-view', {
    data() {
      return {
        map: null,
        markersLayer: null
      };
    },
    template: `
      <div class="component">
        <div class="component-header">
          <div class="component-header-top">
            <select>
              <option>Select view</option>
              <option>Display value</option>
              <option>View web page</option>
              <option>View Wikimedia site</option>
              <option selected>Compare coordinates</option>
              <option>Compare dates</option>
              <option>View all properties</option>
              <option>Reconciliation settings</option>
            </select>
            <select>
              <option>View</option>
              <option>Maximize</option>
              <option>Close</option>
            </select>
          </div>
          <div class="component-header-bottom">
            <div class="row"></div>
          </div>
        </div>
        <div class="component-body">
          <div id="map" style="height: 100%; width: 100%;"></div>
        </div>
      </div>
    `,
    mounted() {
      this.initializeMap();
    },
    methods: {
      initializeMap() {
        this.map = L.map('map').setView([51.505, -0.09], 13);
  
        L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        }).addTo(this.map);
  
        this.markersLayer = L.layerGroup().addTo(this.map);
      },
      updateMarkers(items) {
        this.markersLayer.clearLayers();
  
        const markers = [];
  
        items.forEach((item) => {
          if (item.coord) {
            const coords = item.coord.value.replace('Point(', '').replace(')', '').split(' ');
            const lat = parseFloat(coords[1]);
            const lon = parseFloat(coords[0]);
  
            const imageUrl = item.image ? item.image.value : 'https://via.placeholder.com/100';
            const qid = item.item.value.split('/').pop();
            const popupContent = `
              <div style="text-align: center;">
                <img src="${imageUrl}" alt="Image" style="width: 100px; height: 100px; object-fit: cover; border-radius: 5px;"/><br>
                <strong>${item.itemLabel.value}</strong><br>
                ${item.itemDescription ? item.itemDescription.value : 'No description available'}<br>
                <a href="https://www.wikidata.org/wiki/${qid}" target="_blank" class="qid-link">${qid}</a>
              </div>
            `;
            const marker = L.marker([lat, lon]).bindPopup(popupContent);
            markers.push(marker);
          }
        });
  
        if (markers.length > 0) {
          this.markersLayer.addLayer(L.featureGroup(markers));
          this.map.fitBounds(this.markersLayer.getBounds());
        }
      }
    },
    watch: {
      items(newItems) {
        this.updateMarkers(newItems);
      }
    }
  });
  