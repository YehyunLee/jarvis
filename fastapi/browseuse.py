import asyncio
from dotenv import load_dotenv
from browser_use import Agent, BrowserSession
from langchain_openai import ChatOpenAI
import os
import subprocess
import time

load_dotenv()

# Path to your Chrome executable on Windows:
chrome_path = r'C:\Program Files\Google\Chrome\Application\chrome.exe'

# Your Chrome profile path on Windows:
user_data_dir = r'C:\Users\amrra\AppData\Local\Google\Chrome\User Data\Default'

remote_debug_port = "9222"

def close_all_chrome():
    print("Closing all Chrome processes...")
    # Kill all Chrome processes on Windows
    os.system("taskkill /F /IM chrome.exe /T")
    print("All Chrome processes closed.")

def start_chrome():
    print("Starting Chrome with remote debugging...")
    chrome_cmd = [
        chrome_path,
        f"--remote-debugging-port={remote_debug_port}",
        f"--user-data-dir={user_data_dir}",
        "--no-first-run",  # avoid first run popups
        "--no-default-browser-check"
    ]
    subprocess.Popen(chrome_cmd)
    print(f"Chrome started on port {remote_debug_port} with profile:\n{user_data_dir}")
    time.sleep(5)  # give Chrome a few seconds to fully start

async def task_fxn(task):
    browser_session = BrowserSession(
        cdp_url=f"http://127.0.0.1:{remote_debug_port}"
    )
    agent = Agent(
        task=task,
        llm=ChatOpenAI(model="gpt-4o"),
        browser_session=browser_session,
    )
    await agent.run()

if __name__ == '__main__':
    close_all_chrome()
    time.sleep(2)
    start_chrome()

    DISCORD_LINK = "https://discord.com/channels/@me/1292090498684813443"
    TASK = f"Go to Discord link {DISCORD_LINK} on Open Discord and send 'Hello, world!' to yehun. Be sure to press enter to send the message."

    try:
        asyncio.run(task_fxn(task=TASK))
    except Exception as e:
        print(f"❌ Error: {e}")
    finally:
        close_all_chrome()
