import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ExternalLink } from "lucide-react"
import { formatNumber } from "@/lib/utils"

const MOCK_WEBLETS = [
  { id: "1", name: "Codebot 3000", category: "CODE", status: "Active" as const, chats: 4821, rating: 4.8, revenue: "$1,920" },
  { id: "2", name: "Marketing Guru", category: "MARKETING", status: "Active" as const, chats: 3102, rating: 4.5, revenue: "$1,240" },
  { id: "3", name: "Data Wizard", category: "DATA_ANALYSIS", status: "Active" as const, chats: 2841, rating: 4.6, revenue: "$720" },
  { id: "4", name: "Writing Coach", category: "WRITING", status: "Draft" as const, chats: 0, rating: 0, revenue: "$0" },
  { id: "5", name: "Legal Advisor", category: "LEGAL", status: "Active" as const, chats: 2083, rating: 4.3, revenue: "$400" },
]

export function WebletTable() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-foreground">My Weblets</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Weblet Name</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">30-Day Chats</TableHead>
              <TableHead className="text-right">Avg Rating</TableHead>
              <TableHead className="text-right">Revenue</TableHead>
              <TableHead className="w-12"><span className="sr-only">Actions</span></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {MOCK_WEBLETS.map((weblet) => (
              <TableRow key={weblet.id}>
                <TableCell className="font-medium text-foreground">{weblet.name}</TableCell>
                <TableCell>
                  <Badge variant="secondary" className="text-xs">
                    {weblet.category.replace(/_/g, " ")}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className={weblet.status === "Active" ? "border-primary/20 bg-primary/10 text-primary" : ""}
                  >
                    {weblet.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right text-foreground">{formatNumber(weblet.chats)}</TableCell>
                <TableCell className="text-right text-foreground">
                  {weblet.rating > 0 ? `${weblet.rating}/5.0` : "-"}
                </TableCell>
                <TableCell className="text-right text-foreground">{weblet.revenue}</TableCell>
                <TableCell>
                  <Button variant="ghost" size="sm" asChild>
                    <Link href={`/dashboard/weblet/${weblet.id}`}>
                      <ExternalLink className="mr-1 h-3 w-3" />
                      View
                    </Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
