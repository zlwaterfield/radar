#!/usr/bin/env python3
"""
Test runner script for Radar webhook tests.

This script provides convenient commands to run different types of tests.
"""
import argparse
import subprocess
import sys
from pathlib import Path


def run_command(cmd, description):
    """Run a command and return the result."""
    print(f"\n{'='*60}")
    print(f"Running: {description}")
    print(f"Command: {' '.join(cmd)}")
    print('='*60)
    
    result = subprocess.run(cmd, capture_output=False)
    return result.returncode == 0


def main():
    parser = argparse.ArgumentParser(description="Run Radar webhook tests")
    parser.add_argument(
        "--type", 
        choices=["unit", "integration", "webhook", "notification", "all"],
        default="all",
        help="Type of tests to run"
    )
    parser.add_argument(
        "--coverage", 
        action="store_true",
        help="Run tests with coverage reporting"
    )
    parser.add_argument(
        "--verbose", "-v",
        action="store_true", 
        help="Run tests in verbose mode"
    )
    parser.add_argument(
        "--fast",
        action="store_true",
        help="Skip slow tests"
    )
    
    args = parser.parse_args()
    
    # Base pytest command
    cmd = ["python", "-m", "pytest"]
    
    # Add verbosity
    if args.verbose:
        cmd.append("-v")
    
    # Add coverage
    if args.coverage:
        cmd.extend(["--cov=app", "--cov-report=html", "--cov-report=term-missing"])
    
    # Skip slow tests if requested
    if args.fast:
        cmd.extend(["-m", "not slow"])
    
    # Add test selection based on type
    if args.type == "unit":
        cmd.extend(["-m", "unit"])
    elif args.type == "integration":
        cmd.extend(["-m", "integration"])
    elif args.type == "webhook":
        cmd.extend(["-m", "webhook"])
    elif args.type == "notification":
        cmd.extend(["-m", "notification"])
    elif args.type == "all":
        # Run all tests
        pass
    
    # Add test directory
    cmd.append("tests/")
    
    # Run the tests
    success = run_command(cmd, f"Running {args.type} tests")
    
    if args.coverage and success:
        print(f"\n📊 Coverage report generated in htmlcov/index.html")
    
    if success:
        print(f"\n✅ All {args.type} tests passed!")
        sys.exit(0)
    else:
        print(f"\n❌ Some {args.type} tests failed.")
        sys.exit(1)


if __name__ == "__main__":
    main()