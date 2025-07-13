/** @odoo-module **/
import { _t } from "@web/core/l10n/translation";
import { useService } from "@web/core/utils/hooks";
import { CharField, charField } from "@web/views/fields/char/char_field";
import { useRef, useState, onMounted } from "@odoo/owl";
import { registry } from "@web/core/registry";

/**
 * GeoLocationMap class extends CharField to provide a map with geolocation features.
 */
export class GeoLocationMap extends CharField {
    /**
     * Sets up the component by initializing services, references, and state.
     */

    setup() {
        super.setup();
        this.orm = useService('orm');
        this.mapContainerRef = useRef('mapContainer');
        this.searchInputRef = useRef('searchInput');  // Reference for the search input element

        // Fetch latitude and longitude from the record (if available)
        console.log("Record:", this.props.record);
        console.log("geolocation_maps:", this.props.geolocation_maps);
        console.log("Latitude:",  this.props.record?.data?.latitude);
        console.log("Longitude:", this.props.record?.longitude);
        const initialLatitude = this.props.record?.data?.latitude|| 51.505;  // Default lat: Europe
        const initialLongitude = this.props.record?.data?.longitude || -0.09;  // Default lon: Europe

        this.state = useState({
            latitude: initialLatitude,
            longitude: initialLongitude,
            address: this.props.record[this.props.name] || '',
            currentMarker: null,
        });

        onMounted(() => this._initializeMap());
    }

    /**
     * Initializes the Leaflet map and sets up event handlers.
     */
    async _initializeMap() {
        const mapContainer = this.mapContainerRef.el;

        // Check if the map container is available
        if (!mapContainer) {
            console.error('Map container not found.');
            return;
        }

        // If a map instance already exists, remove it before reinitializing
        if (this._map) {
            this._map.remove();
        }

        // Initialize the map
        this._map = L.map(mapContainer).setView([this.state.latitude, this.state.longitude], 13);

        // Add tile layer
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18 }).addTo(this._map);

        // Add initial marker
        this.state.currentMarker = L.marker([this.state.latitude, this.state.longitude])
            .addTo(this._map)
            .bindPopup('Selected Location')
            .openPopup();

        // Handle map click for manual location selection
        this._map.on('click', async (event) => {
            const { lat, lng } = event.latlng;
            await this._updateLocation(lat, lng);
        });

        // Attach search functionality to search input or button (if applicable)
        this._setupSearchFunctionality();
    }

    /**
     * Retrieves the address for the given latitude and longitude using the Nominatim API.
     */
    async getAddressFromLatLng(latitude, longitude) {
        try {
            const response = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`);
            const data = await response.json();

            // Check if data.address exists and includes the necessary components
            if (data.address) {
                const addressParts = [];
                if (data.address.house_number) addressParts.push(data.address.house_number);
                if (data.address.road) addressParts.push(data.address.road);
                if (data.address.village) addressParts.push(data.address.village);
                if (data.address.city) addressParts.push(data.address.city);
                if (data.address.state) addressParts.push(data.address.state);
                if (data.address.country) addressParts.push(data.address.country);

                // Combine the address components into a full address string
                return addressParts.join(', ');
            } else {
                console.error('Address data not available');
                return null;
            }
        } catch (error) {
            console.error('Error fetching address:', error);
            return null;
        }
    }

    /**
     * Converts an address into latitude and longitude using Nominatim.
     */
    async getLatLngFromAddress(address) {
        try {
            const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}`);
            const data = await response.json();
            console.log("data",data)
            if (data.length > 0) {
                return {
                    latitude: parseFloat(data[0].lat),
                    longitude: parseFloat(data[0].lon),
                };
            }
            return null;
        } catch (error) {
            console.error('Error fetching coordinates:', error);
            return null;
        }
    }

    /**
     * Updates the map location and marker with new coordinates and saves the data.
     */
    async _updateLocation(latitude, longitude) {
        this.state.latitude = latitude;
        this.props.record.latitude = latitude;
        this.state.longitude = longitude;
        this.props.record.longitude = longitude;

        console.log("_updateLocation")
        console.log("latitude",latitude)
        console.log("longitude",longitude)
        // Update the address
        const address = await this.getAddressFromLatLng(latitude, longitude);
        if (address) {
            this.state.address = address;
            await this.props.record.update({
                latitude,
                longitude,
                [this.props.name]: address,
            });
        }

        // Update marker
        if (this.state.currentMarker) {
            this.state.currentMarker.remove();
        }
        this.state.currentMarker = L.marker([latitude, longitude])
            .addTo(this._map)
            .bindPopup('Selected Location')
            .openPopup();
    }

    /**
     * Sets up the search functionality (search input and button).
     */
    _setupSearchFunctionality() {
        const searchInput = this.searchInputRef?.el?.querySelector('input'); // Ensure input element exists
        const searchButton = this.searchInputRef?.el?.querySelector('button');

        if (searchButton && searchInput) {
            searchButton.addEventListener('click', async () => {
                const query = searchInput.value.trim();
                if (query) {
                    await this._searchAndUpdateLocation(query);
                }
            });
        }
    }

    /**
     * Handles searching for a location and updating the map.
     */
    async _searchAndUpdateLocation(query) {
        const coords = await this.getLatLngFromAddress(query);
        if (coords && this._map) {
            await this._updateLocation(coords.latitude, coords.longitude);
            this._map.setView([coords.latitude, coords.longitude], 13);
            console.log("SEarched")
            window.location.reload();

        } else {
            alert('Location not found. Please try again.');
        }
    }

    /**
     * Opens a Google Maps view for the current location.
     */
    async _OpenMapview() {
        const { longitude, latitude } = this.state;
        if (latitude && longitude) {
            window.open(`https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`, '_blank');
        }
    }
}

GeoLocationMap.template = 'GeoLocation';

export const geoLocationMap = {
    ...charField,
    component: GeoLocationMap,
    displayName: _t("GeoLocation Map Viewer"),
};

registry.category("fields").add("geolocation_map", geoLocationMap);
