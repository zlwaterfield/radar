#!/usr/bin/env python3
"""
Simple test script to verify Supabase connection and basic operations.
"""
import asyncio
import os
import sys
from pathlib import Path

# Add the app directory to the Python path
app_path = Path(__file__).parent / "app"
sys.path.insert(0, str(app_path))

from app.core.config import settings
from app.db.supabase import SupabaseManager


async def test_supabase_connection():
    """Test Supabase connection and basic operations."""
    print("🔍 Testing Supabase connection...")
    
    # Test 1: Check environment variables
    print(f"📋 Supabase URL: {settings.SUPABASE_URL[:50]}...")
    print(f"📋 Supabase Key: {settings.SUPABASE_KEY[:10]}...")
    
    # Test 2: Try to fetch all users (should work even if empty)
    try:
        users = await SupabaseManager.get_all_users()
        print(f"✅ Successfully connected to Supabase")
        print(f"📊 Found {len(users)} users in database")
        
        if users:
            print("👥 Sample users:")
            for user in users[:3]:  # Show first 3 users
                print(f"   - {user.get('name', 'Unknown')} ({user.get('slack_id', 'No Slack ID')})")
        
        return True
        
    except Exception as e:
        print(f"❌ Failed to connect to Supabase: {e}")
        return False


async def test_user_operations():
    """Test user CRUD operations."""
    print("\n🧪 Testing user operations...")
    
    try:
        # Test creating a test user
        test_user_data = {
            "slack_id": f"test_user_{int(asyncio.get_event_loop().time())}",
            "slack_team_id": "test_team",
            "slack_access_token": "test_token_encrypted",
            "name": "Test User",
            "email": "test@example.com"
        }
        
        print("📝 Creating test user...")
        created_user = await SupabaseManager.create_user(test_user_data)
        
        if created_user:
            print(f"✅ Test user created with ID: {created_user['id']}")
            
            # Test retrieving the user
            print("🔍 Retrieving test user...")
            retrieved_user = await SupabaseManager.get_user(created_user['id'])
            
            if retrieved_user:
                print(f"✅ Successfully retrieved user: {retrieved_user['name']}")
                
                # Test updating the user
                print("📝 Updating test user...")
                updated_user = await SupabaseManager.update_user(
                    created_user['id'], 
                    {"name": "Updated Test User"}
                )
                
                if updated_user:
                    print(f"✅ Successfully updated user: {updated_user['name']}")
                else:
                    print("❌ Failed to update user")
                
                # Clean up - delete the test user
                print("🗑️ Cleaning up test user...")
                deleted = await SupabaseManager.delete_user(created_user['id'])
                
                if deleted:
                    print("✅ Test user cleaned up successfully")
                else:
                    print("⚠️ Failed to clean up test user")
                    
                return True
            else:
                print("❌ Failed to retrieve created user")
                return False
        else:
            print("❌ Failed to create test user")
            return False
            
    except Exception as e:
        print(f"❌ Error during user operations test: {e}")
        return False


async def test_settings_operations():
    """Test user settings operations."""
    print("\n⚙️ Testing settings operations...")
    
    try:
        # First create a test user
        test_user_data = {
            "slack_id": f"settings_test_{int(asyncio.get_event_loop().time())}",
            "slack_team_id": "test_team",
            "slack_access_token": "test_token_encrypted",
            "name": "Settings Test User"
        }
        
        created_user = await SupabaseManager.create_user(test_user_data)
        
        if not created_user:
            print("❌ Failed to create test user for settings test")
            return False
        
        user_id = created_user['id']
        print(f"📝 Created test user for settings: {user_id}")
        
        # Test getting user settings (should create defaults)
        print("🔍 Getting user settings...")
        settings = await SupabaseManager.get_user_settings(user_id)
        
        if settings:
            print("✅ Successfully retrieved user settings")
            print(f"📊 Settings keys: {list(settings.keys())}")
        else:
            print("❌ Failed to retrieve user settings")
        
        # Test updating settings
        print("📝 Updating user settings...")
        updated_settings = await SupabaseManager.update_user_settings(
            user_id,
            {"stats_time_window": 30}
        )
        
        if updated_settings:
            print("✅ Successfully updated user settings")
        else:
            print("❌ Failed to update user settings")
        
        # Clean up
        await SupabaseManager.delete_user(user_id)
        print("🗑️ Cleaned up test user")
        
        return True
        
    except Exception as e:
        print(f"❌ Error during settings operations test: {e}")
        return False


async def main():
    """Run all tests."""
    print("🚀 Starting Supabase integration tests...\n")
    
    tests = [
        ("Connection Test", test_supabase_connection),
        ("User Operations", test_user_operations),
        ("Settings Operations", test_settings_operations),
    ]
    
    results = []
    
    for test_name, test_func in tests:
        try:
            result = await test_func()
            results.append((test_name, result))
        except Exception as e:
            print(f"❌ {test_name} failed with exception: {e}")
            results.append((test_name, False))
    
    print("\n" + "="*50)
    print("📊 Test Results:")
    print("="*50)
    
    passed = 0
    for test_name, result in results:
        status = "✅ PASSED" if result else "❌ FAILED"
        print(f"{status} - {test_name}")
        if result:
            passed += 1
    
    print(f"\n🎯 {passed}/{len(results)} tests passed")
    
    if passed == len(results):
        print("🎉 All tests passed! Supabase integration is working correctly.")
        sys.exit(0)
    else:
        print("⚠️ Some tests failed. Please check the configuration and database setup.")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())