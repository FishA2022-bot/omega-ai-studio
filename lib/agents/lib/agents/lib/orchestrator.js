import { governorAgent } from "./agents/governor.js"
import { creatorAgent } from "./agents/creator.js"

export async function runTasks() {

  const task = {
    type: "create_feature",
    prompt: "build login page"
  }

  const plan = await governorAgent(task)

  console.log("Plan:", plan)

  const result = await creatorAgent(task)

  console.log("Result:", result)

}

runTasks()
