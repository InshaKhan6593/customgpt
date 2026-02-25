"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useTransition } from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search } from "lucide-react";

export function MarketplaceFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const createQueryString = useCallback(
    (name: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set(name, value);
      } else {
        params.delete(name);
      }
      return params.toString();
    },
    [searchParams]
  );

  const handleSearch = (term: string) => {
    startTransition(() => {
      router.push(`?${createQueryString("q", term)}`);
    });
  };

  const handleCategory = (category: string) => {
    startTransition(() => {
      router.push(`?${createQueryString("category", category === "all" ? "" : category)}`);
    });
  };

  return (
    <div className="flex flex-col sm:flex-row gap-4 mb-8">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search weblets..."
          className="pl-9"
          defaultValue={searchParams.get("q")?.toString()}
          onChange={(e) => handleSearch(e.target.value)}
        />
      </div>
      <div className="w-full sm:w-[200px]">
        <Select
          defaultValue={searchParams.get("category")?.toString() || "all"}
          onValueChange={handleCategory}
        >
          <SelectTrigger>
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            <SelectItem value="Productivity">Productivity</SelectItem>
            <SelectItem value="Writing">Writing</SelectItem>
            <SelectItem value="Coding">Coding</SelectItem>
            <SelectItem value="Education">Education</SelectItem>
            <SelectItem value="Utility">Utility</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
