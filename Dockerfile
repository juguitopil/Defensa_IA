FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY SafeUpdate.sln ./
COPY src/ ./src/
COPY tests/ ./tests/
RUN dotnet restore SafeUpdate.sln
RUN dotnet publish src/SafeUpdate.Api/SafeUpdate.Api.csproj -c Release -o /app/publish

FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app
COPY --from=build /app/publish .
COPY web/ /app/web/
ENV ASPNETCORE_URLS=http://+:8080
EXPOSE 8080
VOLUME ["/app/data/uploads"]
ENTRYPOINT ["dotnet", "SafeUpdate.Api.dll"]
