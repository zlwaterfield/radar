#!/usr/bin/env python3
"""
Database initialization script for Radar.
This script ensures all required tables exist in the Supabase database.
"""
import asyncio
import os
import sys
from pathlib import Path

# Add the app directory to the Python path
app_path = Path(__file__).parent.parent / "app"
sys.path.insert(0, str(app_path))

from app.core.config import settings
from app.db.supabase import SupabaseManager


def read_schema_sql():
    """Read the schema SQL file."""
    schema_file = Path(__file__).parent / "schema.sql"
    
    if not schema_file.exists():
        print(f"❌ Schema file not found: {schema_file}")
        return None
    
    with open(schema_file, 'r') as f:
        return f.read()


async def check_table_exists(table_name: str) -> bool:
    """Check if a table exists in the database."""
    try:
        # Try to query the table
        response = SupabaseManager.supabase.table(table_name).select("count", count="exact").limit(1).execute()
        return True
    except Exception as e:
        print(f"⚠️ Table '{table_name}' does not exist or is not accessible: {e}")
        return False


async def check_database_schema():
    """Check if all required tables exist."""
    print("🔍 Checking database schema...")
    
    required_tables = [
        "users",
        "user_settings", 
        "user_repositories",
        "events",
        "notifications",
        "user_digests"
    ]
    
    missing_tables = []
    
    for table in required_tables:
        exists = await check_table_exists(table)
        if exists:
            print(f"✅ Table '{table}' exists")
        else:
            print(f"❌ Table '{table}' missing")
            missing_tables.append(table)
    
    if missing_tables:
        print(f"\n⚠️ Missing tables: {', '.join(missing_tables)}")
        print("📝 You need to run the schema.sql file in your Supabase SQL editor.")
        print("📄 The schema file is located at: database/schema.sql")
        return False
    else:
        print("✅ All required tables exist!")
        return True


async def test_basic_operations():
    """Test basic database operations."""
    print("\n🧪 Testing basic database operations...")
    
    try:
        # Test 1: Query users table
        print("1. Testing users table query...")
        users = await SupabaseManager.get_all_users()
        print(f"   ✅ Users table accessible (found {len(users)} users)")
        
        # Test 2: Try to create and delete a test user
        print("2. Testing user creation and deletion...")
        test_user_data = {
            "slack_id": f"init_test_{int(asyncio.get_event_loop().time())}",
            "slack_team_id": "test_team",
            "slack_access_token": "encrypted_test_token",
            "name": "Init Test User"
        }
        
        created_user = await SupabaseManager.create_user(test_user_data)
        if created_user:
            print("   ✅ User creation successful")
            
            # Clean up
            deleted = await SupabaseManager.delete_user(created_user['id'])
            if deleted:
                print("   ✅ User deletion successful")
            else:
                print("   ⚠️ User deletion failed")
        else:
            print("   ❌ User creation failed")
            return False
        
        # Test 3: Test settings operations
        print("3. Testing settings operations...")
        
        # Create another test user for settings test
        created_user = await SupabaseManager.create_user(test_user_data)
        if created_user:
            user_id = created_user['id']
            
            # Test settings update
            settings_result = await SupabaseManager.update_user_settings(
                user_id,
                {"stats_time_window": 21}
            )
            
            if settings_result:
                print("   ✅ Settings operations successful")
            else:
                print("   ❌ Settings operations failed")
            
            # Clean up
            await SupabaseManager.delete_user(user_id)
        
        print("✅ All basic operations successful!")
        return True
        
    except Exception as e:
        print(f"❌ Error during basic operations test: {e}")
        return False


async def check_environment():
    """Check environment configuration."""
    print("🔧 Checking environment configuration...")
    
    required_vars = [
        ("SUPABASE_URL", settings.SUPABASE_URL),
        ("SUPABASE_KEY", settings.SUPABASE_KEY)
    ]
    
    missing_vars = []
    
    for var_name, var_value in required_vars:
        if var_value:
            print(f"✅ {var_name}: {'*' * 10}...{var_value[-10:] if len(var_value) > 10 else var_value}")
        else:
            print(f"❌ {var_name}: Not set")
            missing_vars.append(var_name)
    
    if missing_vars:
        print(f"\n⚠️ Missing environment variables: {', '.join(missing_vars)}")
        print("📝 Please check your .env file and ensure all required variables are set.")
        return False
    else:
        print("✅ All required environment variables are set!")
        return True


async def main():
    """Run database initialization checks."""
    print("🚀 Radar Database Initialization Check")
    print("=" * 50)
    
    # Check 1: Environment configuration
    env_ok = await check_environment()
    if not env_ok:
        print("\n❌ Environment check failed. Please fix configuration issues.")
        sys.exit(1)
    
    print("\n" + "-" * 50)
    
    # Check 2: Database schema
    schema_ok = await check_database_schema()
    if not schema_ok:
        print("\n❌ Database schema check failed.")
        print("\n📋 To fix this:")
        print("1. Go to your Supabase project dashboard")
        print("2. Navigate to the SQL Editor")
        print("3. Copy and paste the contents of database/schema.sql")
        print("4. Run the SQL to create all required tables")
        print("5. Run this script again")
        sys.exit(1)
    
    print("\n" + "-" * 50)
    
    # Check 3: Basic operations
    ops_ok = await test_basic_operations()
    if not ops_ok:
        print("\n❌ Basic operations test failed.")
        sys.exit(1)
    
    print("\n" + "=" * 50)
    print("🎉 Database initialization check completed successfully!")
    print("✅ Your Supabase integration is ready to use.")
    print("\n📝 Next steps:")
    print("1. Set up your Slack app credentials")
    print("2. Set up your GitHub app credentials") 
    print("3. Start the Radar application")
    

if __name__ == "__main__":
    asyncio.run(main())