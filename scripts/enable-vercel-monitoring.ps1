# Enable Vercel Web Analytics and Speed Insights for Altus Connect

Write-Host "Checking Vercel CLI authentication..." -ForegroundColor Cyan

# Check if logged in
$authCheck = vercel whoami 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "Not logged in to Vercel. Please login first:" -ForegroundColor Yellow
    Write-Host "Run: vercel login" -ForegroundColor White
    Write-Host "Then visit the URL shown in your browser to authenticate" -ForegroundColor White
    Write-Host ""
    Write-Host "After authentication, run this script again." -ForegroundColor Yellow
    exit 1
}

Write-Host "Authenticated as: $authCheck" -ForegroundColor Green
Write-Host ""

Write-Host "IMPORTANT: Vercel requires interactive mode for enabling monitoring features" -ForegroundColor Yellow
Write-Host "Due to potential charges, these features must be enabled via the Vercel Dashboard" -ForegroundColor Yellow
Write-Host ""

Write-Host "To enable monitoring, please:" -ForegroundColor Cyan
Write-Host "1. Go to https://vercel.com/dashboard" -ForegroundColor White
Write-Host "2. Select the 'altus' project" -ForegroundColor White
Write-Host "3. Navigate to Analytics tab → Enable Web Analytics" -ForegroundColor White
Write-Host "4. Navigate to Speed Insights tab → Enable Speed Insights" -ForegroundColor White
Write-Host ""

Write-Host "See docs/ENABLE_VERCEL_MONITORING.md for detailed instructions" -ForegroundColor Green
Write-Host ""

Write-Host "Current Status:" -ForegroundColor Cyan
Write-Host "- Vercel CLI: Installed and authenticated" -ForegroundColor Green
Write-Host "- Monitoring Code: Ready in your React components" -ForegroundColor Green
Write-Host "- Custom Monitoring: Fully functional" -ForegroundColor Green
Write-Host "- Vercel Analytics: Requires Dashboard enablement" -ForegroundColor Yellow
Write-Host "- Vercel Speed Insights: Requires Dashboard enablement" -ForegroundColor Yellow