# Schedule Skies

This repository hosts the **Schedule Skies** web application, a platform for smart travel
and event planning with real-time environmental analysis. It uses weather forecasts and
traffic predictions to recommend optimal routes and timing for travelers, tourists, and event
planners.

## Project Structure

```
/ (root)
  README.md           - this file
  frontend/           - client web application (HTML/JS or React)
  backend/            - Node.js/Express API server
  Team_7_SRS.pdf      - requirements specification
  Team_7_STD.pdf      - system design document
  Team_7_SPMP.pdf     - project management plan
```

## Getting Started

### Backend

1. `cd backend`
2. Run `npm install` to install dependencies (`express`, `cors`, `axios`).
3. Start the server with `npm run dev` (requires `nodemon`) or `npm start`.
4. The API listens on `http://localhost:3001` by default.

### Frontend

The current frontend is a minimal static page. In the future you can scaffold a React app
(e.g. with `npx create-react-app frontend` or `npm init vite@latest`).

To test now, open `frontend/index.html` in a browser. It makes a request to the backend.

## Next Steps

- Implement weather and traffic service integrations in the backend.
- Build interactive map/components in the frontend.
- Add user authentication and group planning features.
- Refer to the SRS (`Team_7_SRS.pdf`) for detailed functional requirements.

## Purpose

This project follows the SRS introduction: collecting and analyzing requirements to build a
web-based travel planning tool with real-time environmental awareness and collaboration.

## License

(Choose an appropriate license or add later.)
# ScheduleSkies
Schedule Skies, a smart web-based event and travel planning application. 

# RUN THIS COMMANDS

-----npm install @svgr/webpack----