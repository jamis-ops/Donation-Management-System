$src = "C:\Users\James\Downloads\SWU 003 (Final Project) System Design & Governance Document.docx"
$pdf = "C:\Users\James\Downloads\SWU 003 (Final Project) System Design & Governance Document.pdf"
$desktopPdf = "C:\Users\James\OneDrive\Desktop\SWU 003 (Final Project) System Design & Governance Document.pdf"
$projPdf = "c:\Users\James\DonationSystem\SWU 003 (Final Project) System Design & Governance Document.pdf"

$word = New-Object -ComObject Word.Application
$word.Visible = $false
try {
    $doc = $word.Documents.Open($src)
    # 17 represents wdExportFormatPDF
    $doc.ExportAsFixedFormat($pdf, 17)
    $doc.Close()
    Copy-Item $pdf $desktopPdf -Force
    Copy-Item $pdf $projPdf -Force
    Write-Output "Successfully generated full PDF across Downloads, Desktop, and Workspace!"
} catch {
    Write-Error $_.Exception.Message
} finally {
    $word.Quit()
}
