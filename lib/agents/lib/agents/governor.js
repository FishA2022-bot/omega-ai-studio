export async function governorAgent(task) {

  console.log("Governor planning project")

  return {
    tasks: [
      "setup project",
      "build feature",
      "test application"
    ]
  }

}
