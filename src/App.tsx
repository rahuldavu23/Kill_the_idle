import './App.css'

export default function App() {
  return (
    //app-shell is the full screen container that hold the site basically
    <div className = "app-shell">
      {/* LEFT PANEL - this is where the focus/task list will live */}
      <div className="task-panel left">
        <p>Tasks go here </p>
      </div>

      {/* CENTER STAGE - this is where the action will go down, RAMA will be here */}
      <div className="avatar-stage">
        <p>Rama goes here</p>
      </div>
      
      {/* RIGHT PANEL - this is where the enjoy section will live */}
      <div className="task-panel right">
        <p>Enjoy section goes here</p>
      </div>

    </div>
  )
}