import requests
import sys
import json
import time
from datetime import datetime

class OmegaStudioAPITester:
    def __init__(self, base_url="https://docapp-studio-1.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.tests_run = 0
        self.tests_passed = 0
        self.project_id = None

    def run_test(self, name, method, endpoint, expected_status, data=None, timeout=30):
        """Run a single API test"""
        url = f"{self.api_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=timeout)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=timeout)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers, timeout=timeout)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    response_data = response.json()
                    print(f"   Response: {json.dumps(response_data, indent=2)[:200]}...")
                    return True, response_data
                except:
                    return True, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    error_data = response.json()
                    print(f"   Error: {error_data}")
                except:
                    print(f"   Error: {response.text}")
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_root_endpoint(self):
        """Test root API endpoint"""
        return self.run_test("Root API", "GET", "", 200)

    def test_assistant_chat(self):
        """Test AI assistant chat endpoint"""
        test_message = "Build a simple todo app with React and Node.js"
        success, response = self.run_test(
            "AI Assistant Chat",
            "POST",
            "assistant/chat",
            200,
            data={"message": test_message}
        )
        
        if success:
            if "response" in response:
                print(f"   AI Response: {response['response'][:100]}...")
                if "structured" in response:
                    print(f"   Structured Plan: {response['structured']}")
                return True
        return False

    def test_create_project(self):
        """Test project creation"""
        project_data = {
            "name": f"Test Project {datetime.now().strftime('%H%M%S')}",
            "description": "A test project for API validation",
            "prompt": "Build a simple task management app",
            "template": "custom"
        }
        
        success, response = self.run_test(
            "Create Project",
            "POST",
            "projects",
            200,
            data=project_data
        )
        
        if success and "id" in response:
            self.project_id = response["id"]
            print(f"   Created project ID: {self.project_id}")
            return True
        return False

    def test_get_projects(self):
        """Test getting all projects"""
        success, response = self.run_test(
            "Get Projects List",
            "GET",
            "projects",
            200
        )
        
        if success:
            print(f"   Found {len(response)} projects")
            return True
        return False

    def test_get_project_by_id(self):
        """Test getting specific project"""
        if not self.project_id:
            print("❌ No project ID available for testing")
            return False
            
        success, response = self.run_test(
            "Get Project by ID",
            "GET",
            f"projects/{self.project_id}",
            200
        )
        
        if success:
            print(f"   Project name: {response.get('name', 'Unknown')}")
            print(f"   Project status: {response.get('status', 'Unknown')}")
            return True
        return False

    def test_get_activities(self):
        """Test getting project activities"""
        if not self.project_id:
            print("❌ No project ID available for testing")
            return False
            
        success, response = self.run_test(
            "Get Project Activities",
            "GET",
            f"projects/{self.project_id}/activities",
            200
        )
        
        if success:
            print(f"   Found {len(response)} activities")
            return True
        return False

    def test_start_workflow(self):
        """Test starting agent workflow"""
        if not self.project_id:
            print("❌ No project ID available for testing")
            return False
            
        success, response = self.run_test(
            "Start Agent Workflow",
            "POST",
            f"projects/{self.project_id}/start",
            200
        )
        
        if success:
            print(f"   Workflow status: {response.get('status', 'Unknown')}")
            # Wait a bit for workflow to start
            time.sleep(3)
            return True
        return False

    def test_activities_after_workflow(self):
        """Test activities after workflow started"""
        if not self.project_id:
            print("❌ No project ID available for testing")
            return False
            
        success, response = self.run_test(
            "Get Activities After Workflow",
            "GET",
            f"projects/{self.project_id}/activities",
            200
        )
        
        if success:
            print(f"   Found {len(response)} activities after workflow")
            if len(response) > 0:
                latest_activity = response[-1]
                print(f"   Latest activity: {latest_activity.get('message', 'No message')}")
            return True
        return False

    def cleanup_test_project(self):
        """Clean up test project"""
        if not self.project_id:
            return True
            
        success, _ = self.run_test(
            "Delete Test Project",
            "DELETE",
            f"projects/{self.project_id}",
            200
        )
        return success

def main():
    print("🚀 Starting Omega Studio API Tests")
    print("=" * 50)
    
    tester = OmegaStudioAPITester()
    
    # Run all tests in sequence
    tests = [
        tester.test_root_endpoint,
        tester.test_assistant_chat,
        tester.test_create_project,
        tester.test_get_projects,
        tester.test_get_project_by_id,
        tester.test_get_activities,
        tester.test_start_workflow,
        tester.test_activities_after_workflow,
        tester.cleanup_test_project
    ]
    
    for test in tests:
        try:
            test()
        except Exception as e:
            print(f"❌ Test failed with exception: {e}")
    
    # Print final results
    print("\n" + "=" * 50)
    print(f"📊 Test Results: {tester.tests_passed}/{tester.tests_run} passed")
    
    if tester.tests_passed == tester.tests_run:
        print("🎉 All tests passed!")
        return 0
    else:
        print("⚠️  Some tests failed")
        return 1

if __name__ == "__main__":
    sys.exit(main())