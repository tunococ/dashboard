import { EditableDashboard } from "./components/editable-dashboard";

const app = document.getElementById("app");
if (!app) {
  throw "app is null";
}

const editableDashboardTag = EditableDashboard.register();

app.innerHTML = `
  <div style="position: relative; width: 100vw; height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center;">
    <div style="width: 70%; height: 70%; transform: scale(1.1);">
      <${editableDashboardTag} id="editable-dashboard">
      </${editableDashboardTag}>
    </div>
  </div>
`;

