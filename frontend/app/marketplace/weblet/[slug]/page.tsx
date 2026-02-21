"use client"

import Link from "next/link"
import { NavHeader } from "@/components/nav-header"
import { WebletPricingCard } from "@/components/weblet-pricing-card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Star, Globe, Code2, ImageIcon, MessageSquare, ArrowLeft } from "lucide-react"

const MOCK_WEBLET = {
  name: "Data Analyst Pro",
  icon: "DA",
  developer: "Mike",
  category: "DATA_ANALYSIS",
  price: 10,
  rating: 4.9,
  totalChats: 12400,
  capabilities: { webSearch: true, codeInterpreter: true, imageGeneration: false },
  description: `**Data Analyst Pro** helps you make sense of your data with ease.\n\nUpload spreadsheets or CSVs and get:\n- **Instant visualizations** and charts\n- **Statistical analysis** with clear explanations\n- **Actionable recommendations** based on your data\n- **Export-ready reports** in multiple formats\n\nWhether you're a business analyst, researcher, or student, this Weblet handles the heavy lifting so you can focus on decisions.`,
}

export default function WebletDetailPage() {
  const w = MOCK_WEBLET
  const isPaid = w.price > 0

  return (
    <div className="min-h-screen bg-background">
      <NavHeader isLoggedIn />
      <div className="mx-auto max-w-5xl px-4 py-8 lg:px-8">
        <Link href="/marketplace" className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
          Back to Marketplace
        </Link>

        <div className="mt-4 flex flex-col gap-8 lg:flex-row">
          <div className="min-w-0 flex-1">
            <div className="flex items-start gap-4">
              <Avatar className="h-16 w-16 rounded-2xl">
                <AvatarFallback className="rounded-2xl bg-primary/10 text-lg font-bold text-primary">{w.icon}</AvatarFallback>
              </Avatar>
              <div>
                <h1 className="text-2xl font-bold text-foreground">{w.name}</h1>
                <p className="mt-1 text-sm text-muted-foreground">by {w.developer}</p>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{w.category.replace(/_/g, " ")}</Badge>
              {w.capabilities.webSearch && (
                <Badge variant="outline" className="gap-1"><Globe className="h-3 w-3" />Web Search</Badge>
              )}
              {w.capabilities.codeInterpreter && (
                <Badge variant="outline" className="gap-1"><Code2 className="h-3 w-3" />Code Interpreter</Badge>
              )}
              {w.capabilities.imageGeneration && (
                <Badge variant="outline" className="gap-1"><ImageIcon className="h-3 w-3" />Image Generation</Badge>
              )}
            </div>

            <div className="mt-6 flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Star className="h-4 w-4 fill-warning text-warning" />
                <span className="text-sm font-medium text-foreground">{w.rating} / 5.0</span>
                <span className="text-sm text-muted-foreground">Average Rating</span>
              </div>
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium text-foreground">{w.totalChats.toLocaleString()}</span>
                <span className="text-sm text-muted-foreground">Total Chats</span>
              </div>
            </div>

            <div className="mt-8">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">About this Weblet</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="prose prose-sm max-w-none text-muted-foreground">
                    {w.description.split("\n").map((line, i) => {
                      if (line.startsWith("- **")) {
                        const match = line.match(/- \*\*(.+?)\*\*(.*)/)
                        return <p key={i} className="my-1 pl-4">- <strong className="text-foreground">{match?.[1]}</strong>{match?.[2]}</p>
                      }
                      if (line.startsWith("**")) {
                        const match = line.match(/\*\*(.+?)\*\*(.*)/)
                        return <p key={i} className="my-2"><strong className="text-foreground">{match?.[1]}</strong>{match?.[2]}</p>
                      }
                      if (line.trim() === "") return <br key={i} />
                      return <p key={i} className="my-1">{line}</p>
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          <div className="w-full lg:w-80">
            {isPaid ? (
              <WebletPricingCard webletName={w.name} price={w.price} />
            ) : (
              <Card>
                <CardContent className="flex flex-col items-center gap-4 p-6 text-center">
                  <Badge variant="outline" className="text-sm">Free</Badge>
                  <p className="text-sm text-muted-foreground">This Weblet is free to use. Start chatting now!</p>
                  <Link href="/chat/new" className="w-full">
                    <Button className="w-full" size="lg">Start Chatting Now</Button>
                  </Link>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
