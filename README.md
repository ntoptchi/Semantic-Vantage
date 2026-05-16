# Sematic / Vantage (GeoSight)

A geospatial intelligence platform for analyzing environmental signals from satellite data.

It enables users to explore vegetation health, wildfire activity, and water presence on a 3D globe, with derived intelligence that summarizes real-world conditions into actionable insights.

---

## Overview

GeoSight is designed as a lightweight **environmental intelligence system** rather than a traditional map viewer.

It combines multiple satellite-derived signals into a unified interface where users can:

* visualize environmental data layers
* inspect specific locations or regions
* interpret conditions through a centralized intelligence panel

The system emphasizes **signal → context → insight**, bridging raw geospatial data with meaningful interpretation.

---

## Core Features

### Interactive Globe

* WebGL-powered 3D globe
* Smooth navigation, zoom, and exploration
* Layer-based visualization

---

### Unified Intelligence Panel

A centralized control and analysis interface providing:

* active layer management
* real-time signal counts
* temporal controls (1d / 3d / 7d / 14d)
* derived summaries of environmental conditions

---

### Inspect Panel

Click anywhere on the globe to analyze a location.

Displays:

* coordinates
* classification (NDVI, water, etc.)
* confidence / agreement
* imagery metadata
* contextual interpretation

---

### NDVI (Vegetation Health)

* Satellite-based vegetation analysis
* Supports temporal comparison
* Detects vegetation decline patterns

---

### Wildfire Detection

* Live wildfire detections (VIIRS)
* Confidence-based classification
* Integrated into intelligence summaries

---

### Flood / Water Detection

* Surface water classification (MODIS)
* Permanent water baseline + detected water overlay
* Area-based summaries

---

### Vegetation Loss Alerts

* Grid-based detection of vegetation decline
* Severity classification (severe / moderate / mild)
* Ranked and surfaced in the intelligence panel

---

### Hazard Outlook (Derived Intelligence)

A rule-based system that synthesizes existing signals into:

* **Fire Conditions**
* **Vegetation Stress**
* **Water Conditions**

This is not a predictive model, but a derived situational summary based on:

* wildfire detections
* NDVI / vegetation context
* vegetation loss alerts
* flood/water state

---

## Tech Stack

### Frontend

* React + TypeScript
* Vite
* Cesium (WebGL globe rendering)
* Custom CSS (Palantir-style tactical UI)

### Backend

* FastAPI (Python)
* REST-based geospatial services

### Infrastructure

* Docker & Docker Compose (local development)
* Nginx (frontend serving & routing)
* Terraform (infrastructure-as-code)
* AWS-ready architecture (optional deployment path)

---

## Deployment

### Current Approach

The system is designed for **containerized, self-hosted deployment**:

* **Local development**: Docker Compose (see "Running Locally")
* **Production**: Docker containers on your own infrastructure
* Can be hosted via:
  * EC2 (Docker Compose or orchestration)
  * ECS / Fargate (future)
  * Any Docker-compatible platform
  * Nginx for frontend routing

### API Considerations

The backend relies on external geospatial APIs (NASA GIBS, VIIRS, MODIS). Factor those costs into your hosting budget.

---

## Running Locally

### 1. Clone the repo

```bash
git clone https://github.com/ntoptchi/Semantic-Vantage.git
cd geospatial
```

### 2. Run with Docker

```bash
docker compose up --build
```

### 3. Open in browser

```text
http://localhost:5173
```

---

## Design Philosophy

This project is built around:

* **Clarity over clutter**
* **Derived insight over raw data**
* **Fast interaction loops**
* **Minimal but intentional UI**

The interface is inspired by **mission-critical intelligence systems**, focusing on density, precision, and usability.

---

## Future Work

* Region-based (state/province) analysis mode
* Temporal trend modeling for hazard outlook
* Expanded hazard inference (drought, storm systems)
* Full cloud deployment via Terraform + AWS

---

## Author

Nicholas Toptchi
<br>
CS @ USF

